import { Injectable, Logger } from '@nestjs/common';
import {
  SpeechToTextProvider,
  TranscriptionResult,
  TranslationProvider,
  TranslationResult,
  TextToSpeechProvider,
  SynthesisResult,
} from '../voice-processing.interfaces';

/**
 * Phase 1 stub: returns a clearly-marked placeholder instead of calling
 * any real AI service. Safe to wire into the app now so Messages/Tasks
 * can call `transcribe()` without special-casing "AI not implemented yet".
 */
@Injectable()
export class NoopSpeechToTextProvider implements SpeechToTextProvider {
  private readonly logger = new Logger('SpeechToText[stub]');

  async transcribe(input: { audioUrl?: string; mimeType: string }): Promise<TranscriptionResult> {
    this.logger.debug(`transcribe() called for ${input.audioUrl ?? '(buffer)'} — Phase 2 not yet implemented`);
    return {
      text: '[transcription pending — Speech-to-Text is implemented in Phase 2]',
      languageCode: 'und',
      confidence: 0,
    };
  }
}

@Injectable()
export class NoopTranslationProvider implements TranslationProvider {
  private readonly logger = new Logger('Translation[stub]');

  async translate(input: { companyId: string; text: string; sourceLanguage: string; targetLanguage: string }): Promise<TranslationResult> {
    this.logger.debug(`translate() ${input.sourceLanguage}->${input.targetLanguage} — Phase 2 not yet implemented`);
    return {
      translatedText: input.text, // pass-through, NOT a real translation
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      engine: 'noop-stub',
    };
  }

  async translateBatch(input: {
    companyId: string;
    text: string;
    sourceLanguage: string;
    targetLanguages: string[];
  }): Promise<TranslationResult[]> {
    return Promise.all(
      input.targetLanguages.map((targetLanguage) =>
        this.translate({ companyId: input.companyId, text: input.text, sourceLanguage: input.sourceLanguage, targetLanguage }),
      ),
    );
  }
}

@Injectable()
export class NoopTextToSpeechProvider implements TextToSpeechProvider {
  private readonly logger = new Logger('TextToSpeech[stub]');

  async synthesize(input: { text: string; languageCode: string }): Promise<SynthesisResult> {
    this.logger.debug(`synthesize() for language=${input.languageCode} — Phase 2 not yet implemented`);
    return { audioUrl: '', durationMs: 0 };
  }
}
