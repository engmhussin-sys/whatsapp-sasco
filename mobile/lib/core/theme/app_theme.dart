import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Professional SASCO-branded theme. Uses Cairo (a widely-used, highly
/// legible Google Font for Arabic UI, also covers Latin text cleanly)
/// via package:google_fonts — it fetches the font once and caches it
/// locally afterwards (works offline on subsequent launches), which is
/// a reasonable tradeoff given no bundled .ttf asset is available in
/// this delivery. Swap to a bundled font family later for a fully
/// offline-guaranteed first launch if needed.
///
/// FONT-PER-LOCALE: Cairo does not cover Devanagari (hi), Bengali (bn),
/// or Ethiopic (am) scripts — rendering those languages with Cairo would
/// show empty "tofu" boxes instead of real glyphs. `_fontFamilyFor()`
/// below is the single place that decides which Google Font covers a
/// given language, matching exactly what the design handoff specifies.
class AppTheme {
  AppTheme._();

  /// `TextStyle Function({...})` from google_fonts, chosen per
  /// language — every text-theme/AppBar/button/dialog style below is
  /// built through this so switching locale never leaves any surface on
  /// the old (wrong-script) font.
  static TextStyle Function({
    TextStyle? textStyle,
    Color? color,
    Color? backgroundColor,
    double? fontSize,
    FontWeight? fontWeight,
    FontStyle? fontStyle,
    double? letterSpacing,
    double? wordSpacing,
    TextBaseline? textBaseline,
    double? height,
    Locale? locale,
    Paint? foreground,
    Paint? background,
    List<Shadow>? shadows,
    List<FontFeature>? fontFeatures,
    TextDecoration? decoration,
    Color? decorationColor,
    TextDecorationStyle? decorationStyle,
    double? decorationThickness,
  }) _fontFamilyFor(String languageCode) {
    switch (languageCode) {
      case 'hi':
        return GoogleFonts.notoSansDevanagari;
      case 'bn':
        return GoogleFonts.notoSansBengali;
      case 'am':
        return GoogleFonts.notoSansEthiopic;
      default:
        // ar, ur, en, tl all render correctly in Cairo.
        return GoogleFonts.cairo;
    }
  }

  static TextTheme _textThemeFor(String languageCode, Color bodyColor, Color displayColor) {
    switch (languageCode) {
      case 'hi':
        return GoogleFonts.notoSansDevanagariTextTheme().apply(bodyColor: bodyColor, displayColor: displayColor);
      case 'bn':
        return GoogleFonts.notoSansBengaliTextTheme().apply(bodyColor: bodyColor, displayColor: displayColor);
      case 'am':
        return GoogleFonts.notoSansEthiopicTextTheme().apply(bodyColor: bodyColor, displayColor: displayColor);
      default:
        return GoogleFonts.cairoTextTheme().apply(bodyColor: bodyColor, displayColor: displayColor);
    }
  }

  static ThemeData light([Locale locale = const Locale('ar')]) {
    final font = _fontFamilyFor(locale.languageCode);
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.brand,
      brightness: Brightness.light,
      primary: AppColors.brand,
      secondary: AppColors.accent,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.surfaceLight,
      textTheme: _textThemeFor(locale.languageCode, AppColors.textPrimary, AppColors.textPrimary),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: font(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: AppColors.divider),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brand,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.brand.withOpacity(0.4),
          padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 20),
          textStyle: font(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.brand,
          side: BorderSide(color: AppColors.brand),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.brand),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.divider)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.divider)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: AppColors.brand, width: 1.5)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.danger)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: font(color: AppColors.textSecondary, fontSize: 14),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.brandLight,
        labelStyle: font(color: AppColors.brandDark, fontSize: 12, fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        shape: const StadiumBorder(),
        side: BorderSide.none,
      ),
      dividerTheme: DividerThemeData(color: AppColors.divider, thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: AppColors.textPrimary,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.brand,
        unselectedItemColor: AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
      ),
      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        titleTextStyle: font(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
        contentTextStyle: font(fontSize: 14, color: AppColors.textSecondary),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.brand),
      dividerColor: AppColors.divider,
    );
  }

  static ThemeData dark([Locale locale = const Locale('ar')]) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.brand,
      brightness: Brightness.dark,
      primary: AppColors.brand,
      secondary: AppColors.accent,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.surfaceDark,
      textTheme: _textThemeFor(locale.languageCode, Colors.white70, Colors.white),
      appBarTheme: const AppBarTheme(elevation: 0, centerTitle: false, surfaceTintColor: Colors.transparent),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.brand,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
    );
  }
}
