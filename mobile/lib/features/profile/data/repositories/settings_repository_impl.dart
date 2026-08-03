import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../../../core/constants/storage_keys.dart';
import '../../domain/repositories/settings_repository.dart';

class SettingsRepositoryImpl implements SettingsRepository {
  final FlutterSecureStorage _storage;
  SettingsRepositoryImpl(this._storage);

  @override
  Future<String> getLocale() async => await _storage.read(key: StorageKeys.selectedLocale) ?? 'ar';

  @override
  Future<void> setLocale(String localeCode) => _storage.write(key: StorageKeys.selectedLocale, value: localeCode);

  @override
  Future<bool> isDarkMode() async => (await _storage.read(key: StorageKeys.themeMode)) == 'dark';

  @override
  Future<void> setDarkMode(bool isDark) => _storage.write(key: StorageKeys.themeMode, value: isDark ? 'dark' : 'light');

  @override
  Future<bool> isReadAloudEnabled() async => (await _storage.read(key: StorageKeys.readAloudEnabled)) == 'true';

  @override
  Future<void> setReadAloudEnabled(bool enabled) =>
      _storage.write(key: StorageKeys.readAloudEnabled, value: enabled.toString());

  @override
  Future<bool> isLargeTextEnabled() async => (await _storage.read(key: StorageKeys.largeTextEnabled)) == 'true';

  @override
  Future<void> setLargeTextEnabled(bool enabled) =>
      _storage.write(key: StorageKeys.largeTextEnabled, value: enabled.toString());

  @override
  Future<bool> isShowOriginalEnabled() async {
    // Defaults to TRUE — showing the original text is the whole point
    // of the dual-language bubble; a first-time user shouldn't have to
    // discover a setting to see it.
    final raw = await _storage.read(key: StorageKeys.showOriginalEnabled);
    return raw == null ? true : raw == 'true';
  }

  @override
  Future<void> setShowOriginalEnabled(bool enabled) =>
      _storage.write(key: StorageKeys.showOriginalEnabled, value: enabled.toString());
}
