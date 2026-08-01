import { Inject, Injectable } from '@nestjs/common';
import {
  SPEECH_TO_TEXT_PROVIDER,
  SpeechToTextProvider,
  TRANSLATION_PROVIDER,
  TranslationProvider,
  TEXT_TO_SPEECH_PROVIDER,
  TextToSpeechProvider,
} from './voice-processing.interfaces';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VoiceProcessingService {
  constructor(
    @Inject(SPEECH_TO_TEXT_PROVIDER) private stt: SpeechToTextProvider,
    @Inject(TRANSLATION_PROVIDER) private translation: TranslationProvider,
    @Inject(TEXT_TO_SPEECH_PROVIDER) private tts: TextToSpeechProvider,
    private prisma: PrismaService,
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
  }

  async fanOutTranslations(messageId: string, text: string, sourceLanguage: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { company: { include: { supportedLanguages: true } } } } },
    });
    if (!message) return;

    const targetLanguages = message.conversation.company.supportedLanguages
      .map((l: { langCode: string }) => l.langCode)
      .filter((code: string) => code !== sourceLanguage);
    if (targetLanguages.length === 0) return;

    const results = await this.translation.translateBatch({ text, sourceLanguage, targetLanguages });

    await this.prisma.$transaction(
      results.map((r) =>
        this.prisma.messageTranslation.upsert({
          where: { messageId_langCode: { messageId, langCode: r.targetLanguage } },
          create: { messageId, langCode: r.targetLanguage, translatedText: r.translatedText, engine: r.engine },
          update: { translatedText: r.translatedText, engine: r.engine },
        }),
      ),
    );
  }
}
