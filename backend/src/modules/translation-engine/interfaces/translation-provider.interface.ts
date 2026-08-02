/**
 * TRANSLATION ENGINE — Provider Pattern contract.
 * -----------------------------------------------------------------------
 * This interface is the ONLY thing TranslationEngineService depends on —
 * it never imports a concrete provider class directly. Swapping OpenAI
 * for DeepL (or adding a brand new provider) means writing one new class
 * that implements this interface and registering it in
 * TranslationProviderRegistry; nothing else in the system changes.
 *
 * This file (and everything else under translation-engine/) has ZERO
 * imports from any other WorkForce Connect module — it is a standalone,
 * reusable engine by construction, not just by convention.
 */

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationProviderResult {
  translatedText: string;
  /** Provider-reported token usage, when available (null if the provider doesn't expose it, e.g. some REST translation APIs bill per-character instead). */
  tokensUsed: number | null;
  /** Best-effort cost estimate in USD for this single call, when computable from the provider's published pricing. */
  costEstimate: number | null;
}

export interface TranslationProviderConfig {
  apiKey: string | null;
  region?: string | null;
  model?: string | null;
}

export interface TranslationProvider {
  /** Must match a TranslationProviderType enum value — used by the registry to route requests. */
  readonly providerType: string;

  translate(request: TranslationRequest, config: TranslationProviderConfig): Promise<TranslationProviderResult>;
}

export const TRANSLATION_PROVIDER_REGISTRY = 'TRANSLATION_PROVIDER_REGISTRY';
