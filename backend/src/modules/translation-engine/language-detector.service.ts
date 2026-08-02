import { Injectable } from '@nestjs/common';
import { LanguageDetectionResult } from './interfaces/language-detection.interface';

/**
 * Script/character-frequency heuristic language detector. Always
 * available (no API key, no network call, works fully offline) — this
 * is intentionally the PRIMARY detector, not a fallback bolted on as an
 * afterthought, because language detection for a chat message is a
 * latency-sensitive, high-volume operation where an extra AI provider
 * round-trip per message would be wasteful. Provider-based detection
 * (DeepL/Azure/Google all expose one) remains available via
 * TranslationProvider implementations of LanguageDetectionCapable for
 * cases needing higher accuracy on ambiguous/short text — the caller
 * chooses which to use.
 *
 * Covers the language set already supported elsewhere in this codebase
 * (see mobile/lib/core/constants/supported_locales.dart): ar, en, ur,
 * hi, bn, ne (script-distinguishable) — tl (Tagalog) uses Latin script
 * like English and is NOT reliably distinguishable by this heuristic
 * alone; it falls back to 'en' with low confidence, which callers should
 * treat as "unknown, ask the user" rather than a firm answer.
 */
@Injectable()
export class LanguageDetectorService {
  private readonly scriptRanges: { code: string; pattern: RegExp }[] = [
    { code: 'ar', pattern: /[\u0600-\u06FF\u0750-\u077F]/ }, // Arabic + Arabic Supplement (covers Urdu-specific letters too, disambiguated below)
    { code: 'hi', pattern: /[\u0900-\u097F]/ }, // Devanagari (Hindi, Nepali share this block)
    { code: 'bn', pattern: /[\u0980-\u09FF]/ }, // Bengali
  ];

  // Letters that appear in Urdu but not standard Arabic — used to
  // disambiguate the two scripts, which otherwise share the same
  // Unicode block.
  private readonly urduOnlyLetters = /[\u06A9\u06AF\u06BE\u06C1\u06D2\u0679\u0688\u0691]/;
  // Nepali-specific conjuncts/marks rarely used in Hindi — a soft signal,
  // not a hard rule (both languages fully share the Devanagari block).
  private readonly nepaliHints = /[\u0929\u0931\u0934]/;

  detect(text: string): LanguageDetectionResult {
    const sample = text.trim();
    if (sample.length === 0) {
      return { languageCode: 'en', confidence: 0 };
    }

    for (const { code, pattern } of this.scriptRanges) {
      const matches = sample.match(new RegExp(pattern, 'g'));
      if (!matches || matches.length === 0) continue;

      const scriptRatio = matches.length / sample.replace(/\s/g, '').length;
      if (scriptRatio < 0.3) continue; // too few script characters to be confident

      if (code === 'ar' && this.urduOnlyLetters.test(sample)) {
        return { languageCode: 'ur', confidence: Math.min(0.95, 0.6 + scriptRatio * 0.4) };
      }
      if (code === 'hi' && this.nepaliHints.test(sample)) {
        return { languageCode: 'ne', confidence: Math.min(0.7, 0.4 + scriptRatio * 0.3) }; // lower confidence — soft signal only
      }
      return { languageCode: code, confidence: Math.min(0.95, 0.6 + scriptRatio * 0.4) };
    }

    // No non-Latin script detected — default to English. Genuinely
    // distinguishing English from Tagalog (also Latin-script) would need
    // a real statistical model; callers needing that accuracy should use
    // a provider's detectLanguage() instead.
    return { languageCode: 'en', confidence: 0.5 };
  }
}
