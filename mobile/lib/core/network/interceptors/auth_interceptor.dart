import 'package:dio/dio.dart';
import '../../constants/api_constants.dart';
import '../../storage/secure_storage_service.dart';

/// Attaches the Bearer access token to every request, and on a 401
/// response, attempts exactly one silent refresh-and-retry cycle using
/// the stored refresh token — mirroring the rotation logic implemented
/// server-side in AuthService.refresh() (old refresh token is revoked,
/// a new one issued). Concurrent 401s are de-duplicated via
/// [_refreshCompleter] so only one refresh call is in flight at a time.
class AuthInterceptor extends Interceptor {
  final SecureStorageService _secureStorage;
  final Dio _plainDio; // separate instance: no interceptors, avoids recursion
  final void Function() onSessionExpired;

  Future<bool>? _refreshCompleter;

  AuthInterceptor({
    required SecureStorageService secureStorage,
    required this.onSessionExpired,
  })  : _secureStorage = secureStorage,
        _plainDio = Dio(BaseOptions(baseUrl: ApiConstants.baseUrl));

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (options.extra['skipAuth'] != true) {
      final token = await _secureStorage.getAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final isAuthEndpoint = err.requestOptions.path.contains('/auth/');
    if (err.response?.statusCode == 401 && !isAuthEndpoint) {
      final refreshed = await _refresh();
      if (refreshed) {
        try {
          final newToken = await _secureStorage.getAccessToken();
          final retryOptions = err.requestOptions;
          retryOptions.headers['Authorization'] = 'Bearer $newToken';
          final response = await _plainDio.fetch(retryOptions);
          return handler.resolve(response);
        } catch (_) {
          // fall through to session-expired handling below
        }
      }
      await _secureStorage.clearSession();
      onSessionExpired();
    }
    handler.next(err);
  }

  Future<bool> _refresh() {
    // De-duplicate concurrent refresh attempts triggered by multiple
    // simultaneous 401s (e.g. several widgets fetching data at once).
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
        await _secureStorage.saveSession(
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: user,
        );
      } else {
        await _secureStorage.updateAccessToken(newAccessToken);
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}
