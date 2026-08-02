import { Injectable } from '@nestjs/common';
import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationProviderResult,
  TranslationRequest,
} from '../interfaces/translation-provider.interface';

/**
 * Always-available fallback — never calls any external service, never
 * requires an API key. Used when a company has no AI provider configured
 * yet, or as an explicit "translation disabled" choice. Returns the
 * original text with a clear language-tag prefix rather than pretending
 * to translate — callers (and the Translation Audit Log) can see exactly
 * which resolution path answered the request via `providerType: 'OFFLINE_STUB'`.
 */
@Injectable()
export class OfflineStubTranslationProvider implements TranslationProvider {
  readonly providerType = 'OFFLINE_STUB';

  async translate(request: TranslationRequest, _config: TranslationProviderConfig): Promise<TranslationProviderResult> {
    return {
      translatedText: `[${request.targetLanguage}] ${request.text}`,
      tokensUsed: null,
      costEstimate: 0,
    };
  }
}
