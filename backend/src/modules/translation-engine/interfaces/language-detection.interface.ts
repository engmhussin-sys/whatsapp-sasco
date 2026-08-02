/**
 * Optional capability a TranslationProvider MAY implement — not every
 * provider has a dedicated language-detection endpoint (DeepL and Azure
 * do; Google's v2 translate endpoint also supports a detect call; OpenAI
 * would need a prompt-based approach). Kept as a separate interface
 * (rather than bolted onto TranslationProvider) so providers that don't
 * support it simply don't implement it — TranslationEngineService checks
 * `'detectLanguage' in provider` before calling it, with a
 * character-frequency heuristic fallback that always works offline.
 */
export interface LanguageDetectionResult {
  languageCode: string;
  confidence: number; // 0-1
}

export interface LanguageDetectionCapable {
  detectLanguage(text: string, apiKey: string | null): Promise<LanguageDetectionResult>;
}
