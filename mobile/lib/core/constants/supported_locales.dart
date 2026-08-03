import 'package:flutter/material.dart';

/// Every supported (or ready-to-add) locale in one place — adding Urdu,
/// Hindi, Bengali, Tagalog, or Nepali later is exactly: (1) add a JSON
/// file under assets/translations/<code>.json, (2) uncomment/add its
/// entry here. No other code changes, no rebuild-the-app-differently
/// step — this is what "بدون إعادة كتابة التطبيق" required.
class AppLocale {
  final Locale locale;
  final String nativeName;
  final bool isRtl;
  const AppLocale(this.locale, this.nativeName, {this.isRtl = false});
}

class SupportedLocales {
  SupportedLocales._();

  // ACTIVE — translation JSON files exist for all 7 under
  // assets/translations/. isRtl: true only for ar and ur, matching the
  // design handoff spec exactly.
  static const List<AppLocale> active = [
    AppLocale(Locale('ar'), 'العربية', isRtl: true),
    AppLocale(Locale('en'), 'English'),
    AppLocale(Locale('ur'), 'اردو', isRtl: true),
    AppLocale(Locale('hi'), 'हिन्दी'),
    AppLocale(Locale('bn'), 'বাংলা'),
    AppLocale(Locale('tl'), 'Tagalog'),
    AppLocale(Locale('am'), 'አማርኛ'),
  ];

  // READY TO ACTIVATE (architecture supports it today, but it is NOT
  // part of this round's 7-language target set and has no translations
  // JSON file yet — activating it later is exactly: add
  // assets/translations/ne.json, move this entry up to `active`):
  static const List<AppLocale> planned = [
    AppLocale(Locale('ne'), 'नेपाली'),
  ];

  static List<Locale> get activeLocales => active.map((a) => a.locale).toList();
}
