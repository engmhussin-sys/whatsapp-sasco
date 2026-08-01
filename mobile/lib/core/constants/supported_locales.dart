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

  // ACTIVE in Phase 1 (translation JSON files exist for these — see
  // assets/translations/ar.json, en.json):
  static const List<AppLocale> active = [
    AppLocale(Locale('ar'), 'العربية', isRtl: true),
    AppLocale(Locale('en'), 'English'),
  ];

  // READY TO ACTIVATE (architecture supports them today — the ONLY step
  // to enable one is adding its translations JSON file and moving its
  // entry into `active` above):
  static const List<AppLocale> planned = [
    AppLocale(Locale('ur'), 'اردو', isRtl: true),
    AppLocale(Locale('hi'), 'हिन्दी'),
    AppLocale(Locale('bn'), 'বাংলা'),
    AppLocale(Locale('tl'), 'Tagalog'),
    AppLocale(Locale('ne'), 'नेपाली'),
  ];

  static List<Locale> get activeLocales => active.map((a) => a.locale).toList();
}
