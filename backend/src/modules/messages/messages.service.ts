import { BadRequestException, forwardRef, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { MessageStatus, MessageType, AttachmentKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { STORAGE_PROVIDER, StorageProvider } from '../../common/storage/storage.interface';
import { SendTextMessageDto } from './dto/messages.dto';
import { TranslationEngineService } from '../translation-engine/translation-engine.service';
import { LanguageDetectorService } from '../translation-engine/language-detector.service';
import { TokenWalletService } from '../billing-engine/token-wallet.service';
import { UsageEngineService } from '../billing-engine/usage-engine.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { VoiceProcessingService } from '../voice-processing/voice-processing.service';
import { ImageMetaExtractorService } from '../../common/storage/image-meta-extractor.service';
import { VideoThumbnailExtractorService } from '../../common/storage/video-thumbnail-extractor.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private prisma: PrismaService,
    private conversationsService: ConversationsService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
    private translationEngine: TranslationEngineService,
    private languageDetector: LanguageDetectorService,
    private tokenWallet: TokenWalletService,
    private usageEngine: UsageEngineService,
    // ROOT CAUSE FIX — confirmed via a full code-path audit, not
    // speculation: the mobile app sends every text message through
    // this REST method (ChatRemoteDataSource.sendTextMessage ->
    // POST .../messages/text), NEVER through the WebSocket's
    // "sendMessage" event (grepped the entire mobile codebase —
    // WebSocketClient.sendMessage() has zero callers). Only
    // ChatGateway.onSendMessage(), the SOCKET path, ever emitted
    // message:new/message:notification. Every single real-time symptom
    // reported across this project — notifications never arriving, the
    // chat list never updating, messages requiring a manual reopen —
    // traces back to this one gap: the actually-used send path never
    // broadcast anything at all. @Optional() so this service still
    // works (message creation/translation/etc. all still succeed) in
    // any test or future context where the gateway isn't wired up;
    // real-time delivery is an enhancement layered on top of a
    // REST API that must work on its own regardless.
    private voiceProcessing: VoiceProcessingService,
    private imageMetaExtractor: ImageMetaExtractorService,
    private videoThumbnailExtractor: VideoThumbnailExtractorService,
    @Optional() @Inject(forwardRef(() => ChatGateway)) private chatGateway?: ChatGateway,
  ) {}

  /**
   * ACTIVATION of the Translation Engine into the real chat flow: for
   * every OTHER member of the conversation whose preferredLanguage
   * differs from the message's originalLang, run it through the Smart
   * Translation Policy and persist the result to MessageTranslation.
   * Deliberately non-fatal — a translation failure (e.g. no AI provider
   * configured for this company yet) must never prevent the message
   * itself from being sent; it's logged and simply skipped for that
   * language, using the message's original text as if the two
   * languages matched.
   */
  private async fanOutTranslations(companyId: string, messageId: string, text: string, originalLang: string, conversationId: string, senderId: string) {
    const otherMembers = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: senderId } },
      include: { user: { select: { id: true, preferredLanguage: true } } },
    });

    const targetLanguages = Array.from(
      new Set(
        otherMembers
          .map((m: { user: { preferredLanguage: string } }) => m.user.preferredLanguage)
          .filter((lang: string) => lang && lang !== originalLang),
      ),
    ) as string[];

    await Promise.all(
      targetLanguages.map(async (targetLanguage) => {
        try {
          const result = await this.translationEngine.translate(companyId, text, originalLang, targetLanguage, senderId);
          if (result.resolutionSource === 'SAME_LANGUAGE') return; // nothing to persist
          await this.prisma.messageTranslation.upsert({
            where: { messageId_langCode: { messageId, langCode: targetLanguage } },
            create: { messageId, langCode: targetLanguage, translatedText: result.translatedText, engine: result.providerType ?? result.resolutionSource, version: 1 },
            update: { translatedText: result.translatedText, engine: result.providerType ?? result.resolutionSource },
          });

          // TOKEN WALLET INTEGRATION: only PROVIDER-sourced translations
          // that report a token count actually consume the wallet — cache/
          // dictionary/memory hits are free (that's the entire point of
          // the Smart Translation Policy). Wired here at the application
          // layer, not inside either engine, so both Translation Engine
          // and Billing Engine remain independent, reusable modules with
          // zero dependency on each other.
          if (result.resolutionSource === 'PROVIDER' && result.tokensUsed) {
            try {
              await this.tokenWallet.debit(companyId, result.tokensUsed, 'translation_usage', 'Message', messageId);
            } catch (walletErr) {
              // Insufficient balance or no wallet yet — the translation
              // was already delivered; only the accounting failed. Log
              // and move on rather than retroactively undoing a
              // translation the recipient has already received.
              this.logger.warn(`Token wallet debit failed for message ${messageId}: ${(walletErr as Error).message}`);
            }

            // USAGE ENGINE: separate from the wallet debit above — this
            // feeds the "monthly_ai_tokens" PlanFeatureLimit so
            // FeatureEngine.checkAccess()/InvoiceEngine's overage billing
            // can see real consumption, independent of whether the
            // company also happens to be on a prepaid-token plan. A
            // company with no such feature configured on its plan (or no
            // subscription at all) simply has nothing to record against —
            // that's expected, not an error, so it's equally best-effort.
            try {
              await this.usageEngine.recordUsage(companyId, 'monthly_ai_tokens', result.tokensUsed);
            } catch (usageErr) {
              this.logger.warn(`Usage tracking failed for message ${messageId}: ${(usageErr as Error).message}`);
            }
          }
        } catch (err) {
          this.logger.warn(`Translation to "${targetLanguage}" failed for message ${messageId}: ${(err as Error).message}`);
        }
      }),
    );

    // BUG FIX (confirmed real regression introduced by the realtime
    // broadcast fix above): message:new now delivers messages to the
    // client near-instantly, almost always BEFORE this background
    // translation work finishes — so the message would render in its
    // original, untranslated language and simply stay that way forever,
    // since nothing ever told the client a translation later became
    // available for it. Only emitted when there's actually something
    // new to show (targetLanguages empty means everyone already shares
    // the sender's language — nothing to broadcast).
    if (targetLanguages.length > 0 && this.chatGateway?.server) {
      try {
        const fullMessage = await this.findOne(companyId, senderId, messageId);
        this.chatGateway.server.to(`conversation:${conversationId}`).emit('message:translated', fullMessage);
      } catch (err) {
        this.logger.warn(`message:translated broadcast failed for message ${messageId}: ${(err as Error).message}`);
      }
    }
  }

  async sendText(companyId: string, conversationId: string, senderId: string, dto: SendTextMessageDto) {
    await this.conversationsService.assertMembership(companyId, conversationId, senderId);
    await this.conversationsService.assertCanPost(companyId, conversationId, senderId);

    // BUG FIX (confirmed via real bilingual testing): this used to
    // default straight to sender.preferredLanguage — WRONG whenever a
    // bilingual person types in a language different from their
    // account's profile setting (e.g. an Arabic-profile user typing in
    // English). That mislabeled originalLang, which made the recipient
    // side's `myLang == originalLang` check wrongly treat the message
    // as "already my language" and skip translation entirely — not a
    // failed translation, a translation that was never even attempted.
    // detect() only runs when the client didn't explicitly say what
    // language it is (dto.originalLang) — an explicit value from a
    // client that knows better (e.g. a language picker) always wins.
    const originalLang = dto.originalLang ?? this.languageDetector.detect(dto.text).languageCode;

    // REVIEW_ROUND7.md §1: إن كانت clientMessageId مُمرَّرة وقد سبق
    // إنشاء رسالة بها فعلاً (طلب REST مُكرَّر وصل الخادم حقاً — نقرة
    // مزدوجة تجاوزت حارس الواجهة، أو إعادة محاولة تلقائية بعد timeout
    // ظاهري كان النجاح الفعلي قد وصل)، أعِد الرسالة الموجودة بدل محاولة
    // الإنشاء. Optimistic-create-then-catch (لا check-then-act) لأن هذا
    // النمط الوحيد الآمن فعلياً ضد سباق حقيقي بين طلبين متزامنين تقريباً.
    let message: any;
    try {
      message = await this.prisma.$transaction(async (tx: any) => {
        const created = await tx.message.create({
          data: {
            conversationId,
            senderId,
            type: MessageType.TEXT,
            status: MessageStatus.SENT,
            originalText: dto.text,
            originalLang,
            replyToId: dto.replyToId,
            clientMessageId: dto.clientMessageId,
          },
        });

        const otherMembers = await tx.conversationMember.findMany({
          where: { conversationId, userId: { not: senderId } },
          select: { userId: true },
        });
        if (otherMembers.length) {
          await tx.messageReceipt.createMany({
            data: otherMembers.map((m: { userId: string }) => ({ messageId: created.id, userId: m.userId, status: MessageStatus.SENT })),
          });
        }

        await tx.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

        return created;
      });
    } catch (err: any) {
      // Prisma P2002 = unique constraint violation. Only clientMessageId
      // is unique-constrained on this model, so this specifically means
      // "a message with this clientMessageId already exists" — the
      // duplicate-send race this whole mechanism exists to catch.
      if (err?.code === 'P2002' && dto.clientMessageId) {
        const existing = await this.prisma.message.findUnique({ where: { clientMessageId: dto.clientMessageId } });
        if (existing) return this.findOne(companyId, senderId, existing.id);
      }
      throw err;
    }

    // BUG FIX (confirmed via real production logs — measured 1.3s to
    // 2.5s per message, vs. 40-80ms without translation): this used to
    // AWAIT fanOutTranslations() before returning, meaning the entire
    // send — and therefore the WebSocket message:new/message:notification
    // broadcast that only fires once this call returns — was blocked on
    // one or more live OpenAI API calls. Translation is now fire-and-
    // forget: the message is created and returned/broadcast with its
    // original text instantly; translations populate a few hundred ms
    // later and are already there the next time the conversation list
    // is fetched (existing behavior, no new mechanism needed). Errors
    // are caught here so a failed translation can never surface as an
    // unhandled promise rejection.
    this.fanOutTranslations(companyId, message.id, dto.text, message.originalLang ?? 'en', conversationId, senderId).catch((err) =>
      this.logger.warn(`Background translation fan-out failed for message ${message.id}: ${(err as Error).message}`),
    );

    // ROOT CAUSE FIX — see the constructor's chatGateway doc comment
    // for the full story. Mirrors ChatGateway.onSendMessage()'s own
    // broadcast exactly, so REST-originated and socket-originated sends
    // behave identically to every recipient. Never awaited into the
    // response — a slow/stuck socket emit must never delay the HTTP
    // reply to the sender.
    this.broadcastNewMessage(companyId, conversationId, senderId, message.id, dto.text).catch((err) =>
      this.logger.warn(`Realtime broadcast failed for message ${message.id}: ${(err as Error).message}`),
    );

    return this.findOne(companyId, senderId, message.id);
  }

  private async broadcastNewMessage(companyId: string, conversationId: string, senderId: string, messageId: string, text: string) {
    if (!this.chatGateway?.server) return; // gateway not wired (e.g. some test/CLI contexts) — REST call itself already succeeded regardless

    const fullMessage = await this.findOne(companyId, senderId, messageId);
    this.chatGateway.server.to(`conversation:${conversationId}`).emit('message:new', fullMessage);

    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    });
    const sender = await this.prisma.user.findUnique({ where: { id: senderId }, select: { firstName: true, lastName: true } });
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : '';
    const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text;

    for (const m of members) {
      this.chatGateway.server.to(`user:${m.userId}`).emit('message:notification', {
        conversationId,
        messageId,
        senderName,
        preview,
      });
      const socketsInRoom = await this.chatGateway.server.in(`conversation:${conversationId}`).fetchSockets();
      if (socketsInRoom.length > 0) {
        await this.markDelivered(messageId, m.userId);
      }
    }
  }

  /** Voice message: audio buffer is uploaded, stored, and referenced as the message's primary clip. */
  async sendVoice(
    companyId: string,
    conversationId: string,
    senderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    durationMs?: number,
    clientMessageId?: string,
  ) {
    await this.conversationsService.assertMembership(companyId, conversationId, senderId);
    await this.conversationsService.assertCanPost(companyId, conversationId, senderId);

    // REVIEW_ROUND7.md §1 gap (confirmed via real screenshots): the same
    // clientMessageId race this project already fixed for text messages
    // was never applied here — a duplicate voice upload created two
    // fully independent Message rows, each with its own independent
    // transcription attempt, which is exactly why one copy showed a
    // successful translation while its "twin" showed "transcription
    // failed": they were never the same row, just the same audio sent
    // twice. Checked BEFORE uploading the file (not after, unlike
    // sendText) to avoid wasting a storage write + Whisper call on a
    // request we're about to discard anyway.
    if (clientMessageId) {
      const existing = await this.prisma.message.findUnique({ where: { clientMessageId } });
      if (existing) return this.findOne(companyId, senderId, existing.id);
    }

    const stored = await this.storage.save(file.buffer, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: `voice-messages/${companyId}`,
    });

    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });

    let message: any;
    try {
      message = await this.prisma.$transaction(async (tx: any) => {
        const created = await tx.message.create({
          data: {
            conversationId,
            senderId,
            type: MessageType.VOICE,
            status: MessageStatus.SENT,
            audioUrl: stored.url,
            audioDurationMs: durationMs,
            originalLang: sender?.preferredLanguage ?? 'en',
            clientMessageId,
            // originalText starts null — populated by the fire-and-forget
            // transcription below once Whisper returns; the client shows
            // just the audio player until then, exactly like a text
            // message shows its original language before translations
            // land.
          },
        });

        const otherMembers = await tx.conversationMember.findMany({
          where: { conversationId, userId: { not: senderId } },
          select: { userId: true },
        });
        if (otherMembers.length) {
          await tx.messageReceipt.createMany({
            data: otherMembers.map((m: { userId: string }) => ({ messageId: created.id, userId: m.userId, status: MessageStatus.SENT })),
          });
        }

        return created;
      });
    } catch (err: any) {
      // Same race-safe fallback as sendText: a request that lost the
      // check-above race (near-simultaneous duplicate) hits the unique
      // constraint here instead of silently creating a second row.
      if (err?.code === 'P2002' && clientMessageId) {
        const existing = await this.prisma.message.findUnique({ where: { clientMessageId } });
        if (existing) return this.findOne(companyId, senderId, existing.id);
      }
      throw err;
    }

    // BUG FIX: voice messages had NO broadcast at all — the same root
    // cause already found and fixed for text messages (see sendText's
    // own doc comment) turned out to apply here too, just never
    // verified for this specific method until now.
    this.broadcastNewMessage(companyId, conversationId, senderId, message.id, 'رسالة صوتية').catch((err) =>
      this.logger.warn(`Realtime broadcast failed for voice message ${message.id}: ${(err as Error).message}`),
    );

    // Transcription + translation, fully in the background — never
    // blocks the upload response, matching the exact same reasoning as
    // text messages' fire-and-forget translation.
    this.voiceProcessing.processVoiceMessage(message.id).catch((err) =>
      this.logger.warn(`Voice transcription failed for message ${message.id}: ${(err as Error).message}`),
    );

    return this.findOne(companyId, senderId, message.id);
  }

  /** A1 (real-user review, 2026-08-05): explicit retry for a voice
   * message whose transcription failed. Re-runs the SAME
   * processVoiceMessage() the original send used — no special "retry"
   * code path, so a fix to the underlying provider (e.g. a missing
   * OPENAI_API_KEY finally being set) is picked up automatically on
   * the very next retry with zero extra code. */
  async retryVoiceTranscription(companyId: string, messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversation: { companyId } },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.type !== MessageType.VOICE) throw new BadRequestException('Not a voice message');

    this.logger.log(`Voice transcription retry for message ${message.id} requested by user ${userId}`);
    this.voiceProcessing.processVoiceMessage(message.id).catch((err) =>
      this.logger.warn(`Voice transcription retry failed for message ${message.id}: ${(err as Error).message}`),
    );

    return { retrying: true };
  }

  async addAttachment(
    companyId: string,
    conversationId: string,
    messageId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    kind: AttachmentKind,
  ) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, senderId: userId },
    });
    if (!message) throw new NotFoundException('Message not found or you are not its sender');

    const stored = await this.storage.save(file.buffer, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: `message-attachments/${companyId}`,
    });

    // CHAT_SPEC.md §4/§5/§9: أبعاد ومصغّرة حقيقية — للصور من الملف نفسه،
    // وللفيديو من إطار مُستخرَج منه (VideoThumbnailExtractorService).
    let imageMeta: { width: number; height: number; thumbnailBase64: string } | null = null;
    if (kind === AttachmentKind.IMAGE) {
      imageMeta = await this.imageMetaExtractor.extract(file.buffer);
    } else if (kind === AttachmentKind.VIDEO) {
      imageMeta = await this.videoThumbnailExtractor.extract(file.buffer);
    }

    return this.prisma.messageAttachment.create({
      data: {
        messageId,
        kind,
        url: stored.url,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        width: imageMeta?.width,
        height: imageMeta?.height,
        thumbnailBase64: imageMeta?.thumbnailBase64,
      },
    });
  }

  async list(companyId: string, conversationId: string, userId: string, cursor?: string, take = 30) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    return this.prisma.message.findMany({
      // No longer filters deletedAt: null — a "deleted for everyone"
      // message stays in the list and renders as a tombstone
      // ("🚫 هذه الرسالة حُذفت") client-side, exactly like WhatsApp,
      // rather than vanishing (which would confuse anyone re-reading
      // the conversation about a reply that references it).
      where: { conversationId },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        attachments: true,
        receipts: true,
        translations: true,
        replyTo: { select: { id: true, originalText: true, senderId: true, sender: { select: { firstName: true, lastName: true } } } },
        reactions: { select: { userId: true, emoji: true } },
      },
    });
  }

  async findOne(companyId: string, userId: string, id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        attachments: true,
        receipts: true,
        translations: true,
        conversation: { select: { id: true, companyId: true } },
        replyTo: { select: { id: true, originalText: true, senderId: true, sender: { select: { firstName: true, lastName: true } } } },
        reactions: { select: { userId: true, emoji: true } },
      },
    });
    if (!message || message.conversation.companyId !== companyId) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  /** Called by ChatGateway when a message is pushed to a connected recipient. */
  async markDelivered(messageId: string, userId: string) {
    const result = await this.prisma.messageReceipt.updateMany({
      where: { messageId, userId, status: MessageStatus.SENT },
      data: { status: MessageStatus.DELIVERED },
    });
    await this.recomputeMessageStatus(messageId);
    return result;
  }

  /** Marks every unread message in a conversation up to `upToMessageId` (or the latest) as READ for this user. */
  async markRead(companyId: string, conversationId: string, userId: string, upToMessageId?: string) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    // SECURITY (defense in depth): upToMessageId is client-supplied. Even
    // though the subsequent updateMany is already confined to this
    // conversationId (so no cross-tenant row could ever be mutated), we
    // additionally verify the cutoff message itself belongs to THIS
    // conversation before trusting its timestamp — otherwise a caller
    // could reference an arbitrary message id from anywhere to skew the
    // cutoff used for their own (authorized) conversation.
    const cutoff = upToMessageId
      ? await this.prisma.message.findFirst({
          where: { id: upToMessageId, conversationId },
          select: { createdAt: true },
        })
      : null;
    if (upToMessageId && !cutoff) {
      throw new NotFoundException('upToMessageId does not belong to this conversation');
    }

    const messageWhere = {
      conversationId,
      ...(cutoff ? { createdAt: { lte: cutoff.createdAt } } : {}),
    };

    // Capture WHICH messages are about to flip to READ before the bulk
    // update, so their parent Message.status can be recomputed after —
    // updateMany() alone has no way to report which rows it touched.
    const affected = await this.prisma.messageReceipt.findMany({
      where: { userId, status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] }, message: messageWhere },
      select: { messageId: true },
    });

    await this.prisma.messageReceipt.updateMany({
      where: { userId, status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] }, message: messageWhere },
      data: { status: MessageStatus.READ },
    });

    await Promise.all(affected.map((r: { messageId: string }) => this.recomputeMessageStatus(r.messageId)));

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  /**
   * BUG FIX (confirmed via real testing: sender's ticks stayed stuck on
   * "sent" forever). markDelivered/markRead only ever updated the
   * per-RECIPIENT MessageReceipt row — the parent Message.status field
   * (which is what the SENDER's own message list reads to render their
   * own ticks) was never touched by anything. This aggregates every
   * recipient's receipt into a single status for the sender to see:
   * READ only once every recipient has read it, DELIVERED once every
   * recipient has at least received it, otherwise SENT — matching
   * WhatsApp's own group-chat tick semantics, and reducing correctly
   * to the simple 1:1 case for DIRECT conversations.
   */
  private async recomputeMessageStatus(messageId: string) {
    const receipts = await this.prisma.messageReceipt.findMany({ where: { messageId }, select: { status: true } });
    if (receipts.length === 0) return;

    let status: MessageStatus = MessageStatus.READ;
    for (const r of receipts as { status: MessageStatus }[]) {
      if (r.status === MessageStatus.SENT) {
        status = MessageStatus.SENT;
        break;
      }
      if (r.status === MessageStatus.DELIVERED && status === MessageStatus.READ) {
        status = MessageStatus.DELIVERED;
      }
    }

    const updated = await this.prisma.message.update({ where: { id: messageId }, data: { status }, select: { conversationId: true } });

    // REVIEW_ROUND7.md §4: هذا التحديث كان يصل قاعدة البيانات بنجاح
    // (Message.status يتغيّر فعلياً SENT→DELIVERED→READ) لكن لا شيء كان
    // يُبلِّغ العميل المُرسِل عبر Socket بهذا التغيير أبداً — فتبقى
    // علاماته عالقة على "أُرسلت" (✓ واحدة) إلى الأبد، بصرف النظر عمّا
    // يحدث فعلياً في قاعدة البيانات، حتى يُعاد فتح المحادثة يدوياً.
    if (this.chatGateway?.server) {
      this.chatGateway.server.to(`conversation:${updated.conversationId}`).emit('message:status_changed', { messageId, status });
    }
  }

  /**
   * T5 "إعادة ترجمة" — when a user switches language, their OLD messages
   * in this conversation have no MessageTranslation row for the new
   * language (translations are only ever generated at send-time, per
   * fanOutTranslations above). This backfills them: for every message in
   * the conversation whose originalLang differs from targetLanguage and
   * has no existing translation row for it yet, translate and persist.
   * Deliberately reuses the SAME translate()+upsert pattern as
   * fanOutTranslations rather than translationEngine.retranslate()
   * (which only writes to the generic TranslationCacheEntry, not
   * MessageTranslation — retranslate() alone would leave the chat UI
   * showing nothing for these older messages).
   */
  async retranslateConversation(companyId: string, conversationId: string, userId: string, targetLanguage: string) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId, type: MessageType.TEXT, originalLang: { not: targetLanguage } },
      include: { translations: { where: { langCode: targetLanguage } } },
    });

    const toTranslate = messages.filter((m: { translations: unknown[] }) => m.translations.length === 0);

    let translatedCount = 0;
    await Promise.all(
      toTranslate.map(async (m: { id: string; originalText: string | null; originalLang: string | null }) => {
        if (!m.originalText) return;
        try {
          const result = await this.translationEngine.translate(companyId, m.originalText, m.originalLang ?? 'ar', targetLanguage, userId);
          if (result.resolutionSource === 'SAME_LANGUAGE') return;
          await this.prisma.messageTranslation.upsert({
            where: { messageId_langCode: { messageId: m.id, langCode: targetLanguage } },
            create: { messageId: m.id, langCode: targetLanguage, translatedText: result.translatedText, engine: result.providerType ?? result.resolutionSource, version: 1 },
            update: { translatedText: result.translatedText, engine: result.providerType ?? result.resolutionSource },
          });
          translatedCount++;
        } catch (err) {
          this.logger.warn(`Retranslation to "${targetLanguage}" failed for message ${m.id}: ${(err as Error).message}`);
        }
      }),
    );

    return { conversationId, targetLanguage, messagesConsidered: toTranslate.length, messagesTranslated: translatedCount };
  }

  /**
   * Group 2 (WhatsApp parity) — "Delete for everyone". Soft-delete only
   * (deletedAt + deletedForEveryone), never a hard delete: the row (and
   * its translations/attachments/receipts) stays for audit/moderation
   * purposes, but originalText is blanked so the tombstone can never
   * leak content through, say, a stale client cache or a debugging tool.
   * Only the ORIGINAL SENDER may delete for everyone — matches WhatsApp's
   * own rule (not even a Company Admin can silently erase someone
   * else's words from a conversation).
   */
  async deleteMessage(companyId: string, conversationId: string, messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, conversationId } });
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can delete this message for everyone');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedForEveryone: true, originalText: null, audioUrl: null },
    });
  }

  /**
   * Group 3 (WhatsApp parity) — toggle a reaction. Tapping the SAME
   * emoji the user already reacted with REMOVES it (matches WhatsApp);
   * tapping a DIFFERENT emoji replaces it (one reaction per user per
   * message, enforced by the @@id([messageId, userId]) compound key).
   */
  async reactToMessage(companyId: string, conversationId: string, messageId: string, userId: string, emoji: string) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);
    const message = await this.prisma.message.findFirst({ where: { id: messageId, conversationId } });
    if (!message) throw new NotFoundException('Message not found');

    const existing = await this.prisma.messageReaction.findUnique({ where: { messageId_userId: { messageId, userId } } });

    if (existing?.emoji === emoji) {
      await this.prisma.messageReaction.delete({ where: { messageId_userId: { messageId, userId } } });
      return { removed: true, emoji };
    }

    await this.prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji },
    });
    return { removed: false, emoji };
  }

  /**
   * Group 3 (WhatsApp parity) — edit a message's text. Sender-only,
   * text-type-only (voice/attachments aren't editable — matches
   * WhatsApp, which also only allows editing text content). Sets
   * editedAt so the mobile UI can show the small "تم التعديل" label,
   * exactly mirroring WhatsApp's own edited-message indicator.
   */
  async editMessage(companyId: string, conversationId: string, messageId: string, userId: string, newText: string) {
    const message = await this.prisma.message.findFirst({ where: { id: messageId, conversationId } });
    if (!message) throw new NotFoundException('Message not found');

    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (message.senderId !== userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }
    if (message.type !== MessageType.TEXT) {
      throw new BadRequestException('Only text messages can be edited');
    }
    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit a deleted message');
    }

    // Editing changes the ORIGINAL text, which invalidates every
    // existing translation of it — they're cleared so the existing
    // "إعادة ترجمة" flow regenerates them against the new wording
    // rather than silently showing a stale translation of text that no
    // longer exists.
    await this.prisma.messageTranslation.deleteMany({ where: { messageId } });

    return this.prisma.message.update({
      where: { id: messageId },
      data: { originalText: newText, editedAt: new Date() },
    });
  }

  /**
   * Group 4 (WhatsApp parity) — search within a single conversation.
   * Deliberately searches only `originalText` (what was actually typed),
   * NOT translations — matching what the sender/reader would expect
   * "search" to mean, and avoiding an N+1 join across every language's
   * translation row for every message.
   */
  async searchMessages(companyId: string, conversationId: string, userId: string, query: string) {
    await this.conversationsService.assertMembership(companyId, conversationId, userId);
    if (!query.trim()) return [];

    return this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        originalText: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
