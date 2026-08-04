import { Injectable } from '@nestjs/common';
import { TranslationProvider, TranslationResult } from '../voice-processing.interfaces';
import { TranslationEngineService } from '../../translation-engine/translation-engine.service';

/**
 * Bridges VoiceProcessingService's TranslationProvider interface to the
 * SAME TranslationEngineService already used (and already confirmed
 * working in production) for text messages — rather than writing a
 * second, parallel OpenAI-calling implementation here. This means voice
 * transcript translation automatically gets the exact same company
 * provider-selection, caching, and token-wallet/usage-tracking behavior
 * text translation already has, for free.
 */
@Injectable()
export class TranslationEngineBridgeProvider implements TranslationProvider {
  constructor(private translationEngine: TranslationEngineService) {}

  async translate(input: { companyId: string; text: string; sourceLanguage: string; targetLanguage: string }): Promise<TranslationResult> {
    const result = await this.translationEngine.translate(input.companyId, input.text, input.sourceLanguage, input.targetLanguage);
    return {
      translatedText: result.translatedText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      engine: result.providerType ?? result.resolutionSource,
    };
  }

  async translateBatch(input: {
    companyId: string;
    text: string;
    sourceLanguage: string;
    targetLanguages: string[];
  }): Promise<TranslationResult[]> {
    // TranslationEngineService doesn't expose a batch endpoint (each
    // call independently resolves cache/dictionary/provider per target
    // language, which is correct — a batch call would only save network
    // round-trips, not change the actual resolution logic), so this
    // simply fans the batch out into parallel single calls.
    return Promise.all(
      input.targetLanguages.map((targetLanguage) => this.translate({ companyId: input.companyId, text: input.text, sourceLanguage: input.sourceLanguage, targetLanguage })),
    );
  }
}
