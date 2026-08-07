import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MessageType } from '@prisma/client';
import {
  SPEECH_TO_TEXT_PROVIDER,
  SpeechToTextProvider,
  TRANSLATION_PROVIDER,
  TranslationProvider,
  TEXT_TO_SPEECH_PROVIDER,
  TextToSpeechProvider,
} from './voice-processing.interfaces';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyDictionaryService } from '../company-dictionary/company-dictionary.service';
import { ChatGateway } from '../websocket/chat.gateway';
import { WaveformExtractorService } from './providers/waveform-extractor.service';
import * as path from 'path';

/**
 * SYSTEM message templates — canonical, pre-translated strings for
 * backend-generated notices (e.g. "Shift opened", "Task assigned").
 * Consulted BEFORE any provider call for MessageType.SYSTEM messages,
 * per the Smart Translation Policy: system messages are never sent
 * through a general-purpose translation model, since their exact
 * wording matters for consistency and a provider could phrase the same
 * event differently each time.
 *
 * Keyed by the SAME string stored in Message.originalText for a system
 * message (i.e. the "key", not free text) — callers that create SYSTEM
 * messages should use one of these keys as originalText.
 */
const SYSTEM_MESSAGE_TEMPLATES: Record<string, Record<string, string>> = {
  shift_opened: { en: 'Shift opened', ar: 'تم فتح الوردية' },
  shift_closed: { en: 'Shift closed', ar: 'تم إغلاق الوردية' },
  task_assigned: { en: 'A new task was assigned to you', ar: 'تم إسناد مهمة جديدة إليك' },
  approval_requested: { en: 'Your approval is requested', ar: 'مطلوب موافقتك' },
};

@Injectable()
export class VoiceProcessingService {
  private readonly logger = new Logger(VoiceProcessingService.name);

  constructor(
    @Inject(SPEECH_TO_TEXT_PROVIDER) private stt: SpeechToTextProvider,
    @Inject(TRANSLATION_PROVIDER) private translation: TranslationProvider,
    @Inject(TEXT_TO_SPEECH_PROVIDER) private tts: TextToSpeechProvider,
    private prisma: PrismaService,
    private companyDictionary: CompanyDictionaryService,
    private waveformExtractor: WaveformExtractorService,
    // @Global() on ChatGatewayModule (see chat-gateway.module.ts) makes
    // this resolvable without VoiceProcessingModule needing to import
    // it directly — same pattern already proven for MessagesService.
    @Optional() private chatGateway?: ChatGateway,
  ) {}

  /**
   * Phase 2 entry point: transcribes a VOICE message's audio and stores
   * the result back onto originalText, then fans out translations to
   * every language the conversation's company supports. Phase 1 wires
   * this method in but nothing calls it yet (no background job queue
   * configured) — intentionally left as a ready-to-call unit.
   */
  async processVoiceMessage(messageId: string) {
    this.logger.log(`processVoiceMessage(${messageId}) started`);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { company: { include: { supportedLanguages: true } } } } },
    });
    if (!message || !message.audioUrl) {
      this.logger.warn(`processVoiceMessage(${messageId}): message not found or has no audioUrl — aborting`);
      return;
    }

    let transcribedText: string;
    let transcribedLang: string;

    try {
      // BUG FIX (confirmed real, root cause of intermittent transcription
      // failures): mimeType was hardcoded to 'audio/webm' regardless of
      // the actual uploaded file's format. The mobile recorder was
      // rebuilt in a later round to record AAC audio in an .m4a
      // container (audio/mp4) — this hardcoded value was never updated
      // to match, so every transcription request declared the wrong
      // format to the Whisper API. Derived from the stored file's real
      // extension instead, so it always matches what was actually sent.
      const mimeType = this.mimeTypeFromUrl(message.audioUrl);
      const transcription = await this.stt.transcribe({ audioUrl: message.audioUrl, mimeType });
      this.logger.log(`processVoiceMessage(${messageId}): transcription received, persisting`);
      transcribedText = transcription.text;
      transcribedLang = transcription.languageCode;
    } catch (err) {
      // BUG FIX (confirmed via real user report + screenshot: voice
      // bubbles stuck on "جارٍ تحويل الصوت إلى نص..." forever): this
      // used to have NO try/catch at all — an exception here (timeout,
      // missing OPENAI_API_KEY, quota, anything) propagated up to the
      // fire-and-forget .catch() in MessagesService, which only wrote a
      // SERVER LOG line. The message's originalText was never updated,
      // no socket event was ever emitted, so the client had nothing to
      // react to and waited forever. Now: write an honest, real
      // (Arabic) failure notice as the message's own text — and
      // deliberately route it through the SAME fanOutTranslations()
      // pipeline just like a real transcript, so non-Arabic readers
      // ALSO see a translated failure notice, not just Arabic speakers.
      this.logger.warn(`processVoiceMessage(${messageId}): transcription failed — ${(err as Error).message}`);
      transcribedText = 'تعذّر تحويل هذه الرسالة الصوتية إلى نص';
      transcribedLang = 'ar';
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { originalText: transcribedText, originalLang: transcribedLang },
    });

    // CHAT_SPEC.md §3/§9: موجة حقيقية من الملف الفعلي — ليست عشوائية.
    // audioUrl مطلق (LocalStorageProvider: {baseUrl}/uploads/{folder}/
    // {file}) فنستخلص المسار المحلي بإزالة أصل الرابط. فشل الاستخراج
    // لا يمنع بقية المعالجة (WaveformExtractorService لا يرمي أبداً،
    // يُعيد أصفاراً بدلاً من ذلك عند الفشل).
    try {
      const localPath = this.localPathFromUrl(message.audioUrl);
      if (localPath) {
        const waveform = this.waveformExtractor.extract(localPath);
        await this.prisma.message.update({ where: { id: messageId }, data: { voiceWaveform: waveform } });
      }
    } catch (err) {
      this.logger.warn(`processVoiceMessage(${messageId}): waveform extraction failed — ${(err as Error).message}`);
    }

    await this.fanOutTranslations(messageId, transcribedText, transcribedLang);
    this.logger.log(`processVoiceMessage(${messageId}): translations fanned out`);

    // Live update — without this, the voice message bubble would show
    // "transcribing…" (or nothing) forever until the conversation is
    // manually reloaded, exactly the same class of bug already fixed
    // for text messages via message:translated.
    if (this.chatGateway?.server) {
      const full = await this.prisma.message.findUnique({
        where: { id: messageId },
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
      this.chatGateway.server.to(`conversation:${message.conversationId}`).emit('message:translated', full);
      this.logger.log(`processVoiceMessage(${messageId}): message:translated broadcast to room conversation:${message.conversationId} — done`);
    } else {
      this.logger.warn(`processVoiceMessage(${messageId}): ChatGateway not available — transcript saved but NOT broadcast live`);
    }
  }

  /**
   * SMART TRANSLATION POLICY — the exact rules requested in the Product
   * Review:
   *   1. sender language === target language  -> skip, no row created
   *   2. a translation already exists for this (message, targetLanguage)
   *      and `forceRetranslate` is false        -> use the cached row, skip provider
   *   3. message.type === SYSTEM                -> use SYSTEM_MESSAGE_TEMPLATES, never a provider
   *   4. otherwise: check the Company Dictionary for an exact-match term
   *      BEFORE calling any general-purpose provider
   *   5. otherwise: call the TranslationProvider
   *
   * `forceRetranslate` supports "إعادة الترجمة عند تغيير المزود أو
   * القاموس" — passing it bypasses step 2 (existing cache) and always
   * re-resolves via steps 3-5, bumping MessageTranslation.version.
   */
  async fanOutTranslations(
    messageId: string,
    text: string,
    sourceLanguage: string,
    options: { forceRetranslate?: boolean } = {},
  ) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { company: { include: { supportedLanguages: true } } } } },
    });
    if (!message) return;

    const companyId = message.conversation.companyId;
    const targetLanguages = message.conversation.company.supportedLanguages
      .map((l: { langCode: string }) => l.langCode)
      .filter((code: string) => code !== sourceLanguage); // rule 1: same-language pairs never generate a row

    if (targetLanguages.length === 0) return;

    const existing = options.forceRetranslate
      ? []
      : await this.prisma.messageTranslation.findMany({
          where: { messageId, langCode: { in: targetLanguages } },
        });
    const alreadyCachedLangs = new Set(existing.map((e: { langCode: string }) => e.langCode)); // rule 2

    const languagesNeedingTranslation = targetLanguages.filter((l: string) => !alreadyCachedLangs.has(l));
    if (languagesNeedingTranslation.length === 0) return;

    const resolved: { targetLanguage: string; translatedText: string; engine: string }[] = [];

    for (const targetLanguage of languagesNeedingTranslation) {
      if (message.type === MessageType.SYSTEM) {
        // rule 3: templates only, never a provider call
        const template = SYSTEM_MESSAGE_TEMPLATES[text]?.[targetLanguage];
        resolved.push({
          targetLanguage,
          translatedText: template ?? text, // unknown template key: fall back to the raw key rather than guessing
          engine: 'system-template',
        });
        continue;
      }

      // rule 4: company dictionary takes precedence over the general provider
      const dictionaryHit = await this.companyDictionary.lookupExactMatch(companyId, text, sourceLanguage, targetLanguage);
      if (dictionaryHit) {
        resolved.push({ targetLanguage, translatedText: dictionaryHit, engine: 'company-dictionary' });
        continue;
      }

      // rule 5: general-purpose provider (batched together at the end for the remaining languages)
      resolved.push({ targetLanguage, translatedText: '', engine: '' }); // placeholder, filled below
    }

    const providerLanguages = resolved.filter((r) => r.engine === '').map((r) => r.targetLanguage);
    if (providerLanguages.length > 0) {
      const providerResults = await this.translation.translateBatch({
        companyId,
        text,
        sourceLanguage,
        targetLanguages: providerLanguages,
      });
      for (const pr of providerResults) {
        const slot = resolved.find((r) => r.targetLanguage === pr.targetLanguage);
        if (slot) {
          slot.translatedText = pr.translatedText;
          slot.engine = pr.engine;
        }
      }
    }

    await this.prisma.$transaction(
      resolved.map((r) =>
        this.prisma.messageTranslation.upsert({
          where: { messageId_langCode: { messageId, langCode: r.targetLanguage } },
          create: { messageId, langCode: r.targetLanguage, translatedText: r.translatedText, engine: r.engine, version: 1 },
          update: {
            translatedText: r.translatedText,
            engine: r.engine,
            version: options.forceRetranslate ? { increment: 1 } : undefined,
          },
        }),
      ),
    );
  }

  /** Explicit re-translation trigger (Company Admin action) — see Smart Translation Policy rule above. */
  async retranslateMessage(messageId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message || !message.originalText || !message.originalLang) return;
    await this.fanOutTranslations(messageId, message.originalText, message.originalLang, { forceRetranslate: true });
  }

  /** يشتقّ المسار المحلي على القرص من رابط رفع مطلق — عكس ما يبنيه
   * LocalStorageProvider.save() بالضبط ({baseUrl}/uploads/{folder}/
   * {file} -> process.cwd()/uploads/{folder}/{file}). يُعيد null إن لم
   * يحتوِ الرابط جزء "/uploads/" المتوقَّع (رابط خارجي غير محلي مثلاً). */
  private localPathFromUrl(audioUrl: string): string | null {
    const marker = '/uploads/';
    const idx = audioUrl.indexOf(marker);
    if (idx === -1) return null;
    const relative = audioUrl.slice(idx + marker.length);
    return path.join(process.cwd(), 'uploads', relative);
  }

  /** يُشتَق من امتداد الملف الفعلي المُخزَّن بدل الافتراض الثابت الخاطئ.
   * m4a هو الافتراضي الحالي (مسجِّل الموبايل يستخدم AAC/m4a)، مع تغطية
   * الصيغ الأخرى المحتملة تاريخياً أو من مصادر رفع بديلة مستقبلية. */
  private mimeTypeFromUrl(audioUrl: string): string {
    const ext = audioUrl.split('.').pop()?.toLowerCase().split('?')[0];
    switch (ext) {
      case 'webm':
        return 'audio/webm';
      case 'wav':
        return 'audio/wav';
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg':
        return 'audio/ogg';
      case 'm4a':
      case 'mp4':
      case 'aac':
      default:
        return 'audio/mp4';
    }
  }
}
