import 'package:dio/dio.dart';
import '../../storage/secure_storage_service.dart';
import '../token_refresh_service.dart';

/// Attaches the Bearer access token to every request, and on a 401
/// response, attempts exactly one silent refresh-and-retry cycle via
/// the SHARED TokenRefreshService (also used by WebSocketClient, so
/// both HTTP and the socket self-heal from an expired token the same
/// way — see token_refresh_service.dart's doc comment for the bug this
/// sharing fixes).
class AuthInterceptor extends Interceptor {
  final SecureStorageService _secureStorage;
  final TokenRefreshService _tokenRefresh;
  final Dio _plainDio; // separate instance: no interceptors, avoids recursion
  final void Function() onSessionExpired;

  AuthInterceptor({
    required SecureStorageService secureStorage,
    required TokenRefreshService tokenRefresh,
    required this.onSessionExpired,
  })  : _secureStorage = secureStorage,
        _tokenRefresh = tokenRefresh,
        _plainDio = Dio();

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
      final refreshed = await _tokenRefresh.refresh();
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
}
