/// App-local preferences (locale/theme) — deliberately NOT wrapped in
/// Either<Failure,...> like the network-backed repositories: these are
/// pure local reads/writes that essentially cannot fail in a way the UI
/// needs to react to, so the added ceremony isn't justified here.
abstract class SettingsRepository {
  Future<String> getLocale();
  Future<void> setLocale(String localeCode);
  Future<bool> isDarkMode();
  Future<void> setDarkMode(bool isDark);
}
