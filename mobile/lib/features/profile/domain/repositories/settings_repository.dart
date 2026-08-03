/// App-local preferences (locale/theme/accessibility) — deliberately NOT
/// wrapped in Either<Failure,...> like the network-backed repositories:
/// these are pure local reads/writes that essentially cannot fail in a
/// way the UI needs to react to, so the added ceremony isn't justified
/// here.
abstract class SettingsRepository {
  Future<String> getLocale();
  Future<void> setLocale(String localeCode);
  Future<bool> isDarkMode();
  Future<void> setDarkMode(bool isDark);

  /// Auto-reads incoming chat messages aloud via TtsService.
  Future<bool> isReadAloudEnabled();
  Future<void> setReadAloudEnabled(bool enabled);

  /// Scales all app text up for readability (MediaQuery.textScaler).
  Future<bool> isLargeTextEnabled();
  Future<void> setLargeTextEnabled(bool enabled);

  /// Controls whether the "original text" row shows under a translation
  /// in message_bubble.dart — independent from whether a translation
  /// exists at all (isTranslatedFor), this is a pure display preference.
  Future<bool> isShowOriginalEnabled();
  Future<void> setShowOriginalEnabled(bool enabled);
}
