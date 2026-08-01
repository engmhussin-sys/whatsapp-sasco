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
}
