import { Inject, Injectable, Optional } from '@nestjs/common';
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
  constructor(
    @Inject(SPEECH_TO_TEXT_PROVIDER) private stt: SpeechToTextProvider,
    @Inject(TRANSLATION_PROVIDER) private translation: TranslationProvider,
    @Inject(TEXT_TO_SPEECH_PROVIDER) private tts: TextToSpeechProvider,
    private prisma: PrismaService,
    private companyDictionary: CompanyDictionaryService,
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
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { company: { include: { supportedLanguages: true } } } } },
    });
    if (!message || !message.audioUrl) return;

    const transcription = await this.stt.transcribe({ audioUrl: message.audioUrl, mimeType: 'audio/webm' });

    await this.prisma.message.update({
      where: { id: messageId },
      data: { originalText: transcription.text, originalLang: transcription.languageCode },
    });

    await this.fanOutTranslations(messageId, transcription.text, transcription.languageCode);

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
}
