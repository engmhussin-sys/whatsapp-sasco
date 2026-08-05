/// V3 design rule (section 5): "الأرقام عربية-هندية في العربية والأردية،
/// ولاتينية في بقية اللغات" — Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in
/// Arabic/Urdu locales, plain Latin digits (0123456789) everywhere else.
///
/// Deliberately does NOT touch phone numbers or international codes —
/// section 5's own rule carves those out explicitly ("أرقام الهواتف
/// والرموز الدولية داخل واجهة RTL تحتاج Directionality... " — i.e. they
/// stay Latin + LTR regardless of locale). Callers displaying a phone
/// number should NOT run it through this converter.
class LocaleNumerals {
  LocaleNumerals._();

  static const _easternArabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /// True for the two locales this rule applies to.
  static bool usesEasternArabicDigits(String languageCode) => languageCode == 'ar' || languageCode == 'ur';

  /// Converts every ASCII digit in [input] to its Eastern Arabic
  /// equivalent if [languageCode] is ar/ur; returns [input] unchanged
  /// otherwise. Safe to call on any string — non-digit characters
  /// (including RTL punctuation, %, /, etc.) pass through untouched.
  static String format(String input, String languageCode) {
    if (!usesEasternArabicDigits(languageCode)) return input;
    final buffer = StringBuffer();
    for (final rune in input.runes) {
      if (rune >= 0x30 && rune <= 0x39) {
        buffer.write(_easternArabicDigits[rune - 0x30]);
      } else {
        buffer.writeCharCode(rune);
      }
    }
    return buffer.toString();
  }
}
