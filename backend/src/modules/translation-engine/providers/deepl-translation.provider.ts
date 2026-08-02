import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationProviderResult,
  TranslationRequest,
} from '../interfaces/translation-provider.interface';

/** Real implementation — DeepL API. Auto-detects Free vs Pro tier from the API key's suffix (DeepL's own convention: Free-tier keys end in ":fx"), since the two tiers use different base URLs. */
@Injectable()
export class DeepLTranslationProvider implements TranslationProvider {
  readonly providerType = 'DEEPL';
  private readonly logger = new Logger(DeepLTranslationProvider.name);

  async translate(request: TranslationRequest, config: TranslationProviderConfig): Promise<TranslationProviderResult> {
    if (!config.apiKey) {
      throw new ServiceUnavailableException('DeepL translation provider is not configured (missing API key)');
    }

    const isFreeTier = config.apiKey.endsWith(':fx');
    const baseUrl = isFreeTier ? 'https://api-free.deepl.com' : 'https://api.deepl.com';

    const response = await fetch(`${baseUrl}/v2/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${config.apiKey}`,
      },
      body: JSON.stringify({
        text: [request.text],
        source_lang: request.sourceLanguage.toUpperCase(),
        target_lang: request.targetLanguage.toUpperCase(),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`DeepL request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('DeepL translation provider request failed');
    }

    const data = (await response.json()) as { translations: { text: string }[] };
    const translatedText = data.translations?.[0]?.text ?? '';
    // Billed per character (published Pro rate: ~$25/1M chars) — no token concept.
    const costEstimate = (request.text.length / 1_000_000) * 25;

    return { translatedText, tokensUsed: null, costEstimate };
  }
}
