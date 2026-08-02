import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationProviderResult,
  TranslationRequest,
} from '../interfaces/translation-provider.interface';

/** Real implementation — Google Cloud Translation API v2 (API-key auth, the simplest auth mode; v3/service-account auth is a documented future upgrade path, not needed for this Provider Pattern to already be swap-ready). */
@Injectable()
export class GoogleTranslationProvider implements TranslationProvider {
  readonly providerType = 'GOOGLE';
  private readonly logger = new Logger(GoogleTranslationProvider.name);

  async translate(request: TranslationRequest, config: TranslationProviderConfig): Promise<TranslationProviderResult> {
    if (!config.apiKey) {
      throw new ServiceUnavailableException('Google Cloud Translation provider is not configured (missing API key)');
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: request.text,
        source: request.sourceLanguage,
        target: request.targetLanguage,
        format: 'text',
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Google Translate request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Google Cloud Translation provider request failed');
    }

    const data = (await response.json()) as {
      data: { translations: { translatedText: string }[] };
    };

    const translatedText = data.data?.translations?.[0]?.translatedText ?? '';
    // Google Translate v2 doesn't return token counts — it bills per
    // character, so token tracking is intentionally null here; cost is
    // estimated from character count at the published $20/1M chars rate.
    const costEstimate = (request.text.length / 1_000_000) * 20;

    return { translatedText, tokensUsed: null, costEstimate };
  }
}
