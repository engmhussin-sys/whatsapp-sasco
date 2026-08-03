class CountryPhoneInfo {
  final String code; // ISO 3166-1 alpha-2
  final String nameAr;
  final String flag;
  final String dialCode;
  final int nationalNumberLength; // digits after the dial code
  final String exampleFormat;

  const CountryPhoneInfo({
    required this.code,
    required this.nameAr,
    required this.flag,
    required this.dialCode,
    required this.nationalNumberLength,
    required this.exampleFormat,
  });

  String get fullExample => '$dialCode $exampleFormat';
}

/// Gulf + Egypt country list per explicit request — easy to extend with
/// more countries later (just add another entry, nothing else changes).
const List<CountryPhoneInfo> kSupportedCountries = [
  CountryPhoneInfo(code: 'SA', nameAr: 'السعودية', flag: '🇸🇦', dialCode: '+966', nationalNumberLength: 9, exampleFormat: '5X XXX XXXX'),
  CountryPhoneInfo(code: 'EG', nameAr: 'مصر', flag: '🇪🇬', dialCode: '+20', nationalNumberLength: 10, exampleFormat: '1X XXXX XXXX'),
  CountryPhoneInfo(code: 'QA', nameAr: 'قطر', flag: '🇶🇦', dialCode: '+974', nationalNumberLength: 8, exampleFormat: 'XXXX XXXX'),
  CountryPhoneInfo(code: 'BH', nameAr: 'البحرين', flag: '🇧🇭', dialCode: '+973', nationalNumberLength: 8, exampleFormat: 'XXXX XXXX'),
  CountryPhoneInfo(code: 'AE', nameAr: 'الإمارات', flag: '🇦🇪', dialCode: '+971', nationalNumberLength: 9, exampleFormat: '5X XXX XXXX'),
];
