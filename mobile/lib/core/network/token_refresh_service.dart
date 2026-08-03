import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

/// Single source of truth for the access-token refresh call, extracted
/// out of AuthInterceptor so WebSocketClient can share it too.
///
/// WHY THIS EXISTS (real bug, not speculative): the WebSocket previously
/// read whatever access token happened to be in secure storage at
/// connect() time — if the app was reopened after the token expired,
/// the very FIRST socket connection attempt failed with "invalid
/// signature" (confirmed in a real production log) and nothing ever
/// retried it, because HTTP requests self-heal via AuthInterceptor's
/// 401-refresh-retry cycle but the socket had no equivalent. This
/// service lets WebSocketClient do the same refresh-and-retry dance.
class TokenRefreshService {
  final SecureStorageService _secureStorage;
  final Dio _plainDio; // no interceptors — avoids recursion into itself

  Future<bool>? _refreshCompleter;

  TokenRefreshService(this._secureStorage) : _plainDio = Dio(BaseOptions(baseUrl: ApiConstants.baseUrl));

  /// De-duplicates concurrent refresh attempts (e.g. an HTTP 401 and a
  /// socket connect failure happening at nearly the same moment) so only
  /// one refresh call is ever in flight.
  Future<bool> refresh() {
    _refreshCompleter ??= _doRefresh().whenComplete(() => _refreshCompleter = null);
    return _refreshCompleter!;
  }

  Future<bool> _doRefresh() async {
    final refreshToken = await _secureStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final response = await _plainDio.post(
        ApiConstants.refresh,
        data: {'refreshToken': refreshToken},
      );
      final newAccessToken = response.data['accessToken'] as String;
      final newRefreshToken = response.data['refreshToken'] as String;
      final user = await _secureStorage.getUser();
      if (user != null) {
        await _secureStorage.saveSession(accessToken: newAccessToken, refreshToken: newRefreshToken, user: user);
      } else {
        await _secureStorage.updateAccessToken(newAccessToken);
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
