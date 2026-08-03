import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../constants/storage_keys.dart';

/// Wraps flutter_secure_storage (Keychain on iOS, EncryptedSharedPreferences
/// on Android) for anything session-sensitive. Never store tokens in plain
/// SharedPreferences — this is the ONLY place session data is persisted.
abstract class SecureStorageService {
  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required Map<String, dynamic> user,
  });
  Future<String?> getAccessToken();
  Future<String?> getRefreshToken();
  Future<Map<String, dynamic>?> getUser();
  Future<void> updateAccessToken(String accessToken);

  /// Overwrites the persisted user object only (tokens untouched) — used
  /// after a profile change (e.g. preferredLanguage) so the app opens in
  /// the correct language on next launch even before the network call
  /// that re-validates the session completes.
  Future<void> updateUser(Map<String, dynamic> user);

  Future<void> clearSession();
}

class SecureStorageServiceImpl implements SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageServiceImpl(this._storage);

  @override
  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required Map<String, dynamic> user,
  }) async {
    await Future.wait([
      _storage.write(key: StorageKeys.accessToken, value: accessToken),
      _storage.write(key: StorageKeys.refreshToken, value: refreshToken),
      _storage.write(key: StorageKeys.currentUser, value: jsonEncode(user)),
    ]);
  }

  @override
  Future<String?> getAccessToken() => _storage.read(key: StorageKeys.accessToken);

  @override
  Future<String?> getRefreshToken() => _storage.read(key: StorageKeys.refreshToken);

  @override
  Future<Map<String, dynamic>?> getUser() async {
    final raw = await _storage.read(key: StorageKeys.currentUser);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  @override
  Future<void> updateAccessToken(String accessToken) =>
      _storage.write(key: StorageKeys.accessToken, value: accessToken);

  @override
  Future<void> updateUser(Map<String, dynamic> user) =>
      _storage.write(key: StorageKeys.currentUser, value: jsonEncode(user));

  @override
  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: StorageKeys.accessToken),
      _storage.delete(key: StorageKeys.refreshToken),
      _storage.delete(key: StorageKeys.currentUser),
    ]);
  }
}
