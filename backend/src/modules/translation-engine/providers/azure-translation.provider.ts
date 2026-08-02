import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationProviderResult,
  TranslationRequest,
} from '../interfaces/translation-provider.interface';

/** Real implementation — Azure AI Translator (Text Translation) REST API v3.0. Requires both a subscription key AND a region (Azure-specific — most other providers only need a key). */
@Injectable()
export class AzureTranslationProvider implements TranslationProvider {
  readonly providerType = 'AZURE';
  private readonly logger = new Logger(AzureTranslationProvider.name);

  async translate(request: TranslationRequest, config: TranslationProviderConfig): Promise<TranslationProviderResult> {
    if (!config.apiKey) {
      throw new ServiceUnavailableException('Azure Translator provider is not configured (missing API key)');
    }
    if (!config.region) {
      throw new ServiceUnavailableException('Azure Translator provider is not configured (missing region)');
    }

    const url =
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0` +
      `&from=${encodeURIComponent(request.sourceLanguage)}&to=${encodeURIComponent(request.targetLanguage)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Ocp-Apim-Subscription-Region': config.region,
        'X-ClientTraceId': randomUUID(),
      },
      body: JSON.stringify([{ text: request.text }]),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Azure Translator request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('Azure Translator provider request failed');
    }

    const data = (await response.json()) as { translations: { text: string }[] }[];
    const translatedText = data?.[0]?.translations?.[0]?.text ?? '';
    // Billed per character (published rate: $10/1M chars, Standard tier) — no token concept.
    const costEstimate = (request.text.length / 1_000_000) * 10;

    return { translatedText, tokensUsed: null, costEstimate };
  }
}
