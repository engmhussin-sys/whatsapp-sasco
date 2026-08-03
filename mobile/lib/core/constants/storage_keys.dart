/// Keys used with SecureStorageService. Centralized to avoid typo-based
/// bugs across features that all need to read/write the same session data.
class StorageKeys {
  StorageKeys._();

  static const String accessToken = 'wfc_access_token';
  static const String refreshToken = 'wfc_refresh_token';
  static const String currentUser = 'wfc_current_user';
  static const String selectedLocale = 'wfc_selected_locale';
  static const String themeMode = 'wfc_theme_mode';
  static const String readAloudEnabled = 'wfc_read_aloud_enabled';
  static const String largeTextEnabled = 'wfc_large_text_enabled';
  static const String showOriginalEnabled = 'wfc_show_original_enabled';
}
