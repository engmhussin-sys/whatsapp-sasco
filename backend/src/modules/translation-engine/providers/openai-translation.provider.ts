import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  TranslationProvider,
  TranslationProviderConfig,
  TranslationProviderResult,
  TranslationRequest,
} from '../interfaces/translation-provider.interface';

/**
 * Real implementation — calls OpenAI's Chat Completions API (OpenAI has
 * no dedicated translation endpoint) with a minimal, deterministic
 * translate-only prompt. Requires a real API key at call time (from
 * TranslationProviderConfig.apiKey, itself resolved from an env var by
 * TranslationProviderRegistry) — throws a clear error if missing rather
 * than silently returning a fake result.
 */
@Injectable()
export class OpenAiTranslationProvider implements TranslationProvider {
  readonly providerType = 'OPENAI';
  private readonly logger = new Logger(OpenAiTranslationProvider.name);

  async translate(request: TranslationRequest, config: TranslationProviderConfig): Promise<TranslationProviderResult> {
    if (!config.apiKey) {
      throw new ServiceUnavailableException('OpenAI translation provider is not configured (missing API key)');
    }

    const model = config.model ?? 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Translate the user message from ' +
              `${request.sourceLanguage} to ${request.targetLanguage}. ` +
              'Respond with ONLY the translated text, no explanations, no quotes.',
          },
          { role: 'user', content: request.text },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`OpenAI translation request failed: ${response.status} ${body}`);
      throw new ServiceUnavailableException('OpenAI translation provider request failed');
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { total_tokens?: number };
    };

    const translatedText = data.choices?.[0]?.message?.content?.trim() ?? '';
    const tokensUsed = data.usage?.total_tokens ?? null;
    // Rough, published-pricing-based estimate for gpt-4o-mini ($0.15/1M input + $0.60/1M output,
    // blended here as a conservative single rate since we don't split input/output tokens) —
    // update if the configured model differs materially in price.
    const costEstimate = tokensUsed !== null ? (tokensUsed / 1_000_000) * 0.375 : null;

    return { translatedText, tokensUsed, costEstimate };
  }
}
