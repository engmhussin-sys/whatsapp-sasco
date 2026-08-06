import 'package:workforce_connect_ai/core/theme/design_tokens.dart' show localizedDigits;

/// V3 design rule (section 5): "الأرقام عربية-هندية في العربية والأردية،
/// ولاتينية في بقية اللغات" — Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) in
/// Arabic/Urdu locales, plain Latin digits (0123456789) everywhere else.
///
/// Deliberately does NOT touch phone numbers or international codes —
/// section 5's own rule carves those out explicitly ("أرقام الهواتف
/// والرموز الدولية داخل واجهة RTL تحتاج Directionality... " — i.e. they
/// stay Latin + LTR regardless of locale). Callers displaying a phone
/// number should NOT run it through this converter.
///
/// Task 5 (design_handoff_atheel_community/PROMPT_CATCHUP.md) —
/// `localizedDigits()` in design_tokens.dart is now the ONE canonical
/// implementation ("المصدر الوحيد لقيم التصميم" — its own explicit
/// rule); this class is kept as a thin wrapper so the earlier call site
/// (station_pages.dart) and this class's own tests keep working
/// unchanged, rather than duplicating the same digit-mapping logic twice.
class LocaleNumerals {
  LocaleNumerals._();

  static bool usesEasternArabicDigits(String languageCode) => languageCode == 'ar' || languageCode == 'ur';

  static String format(String input, String languageCode) => localizedDigits(input, languageCode);
}
