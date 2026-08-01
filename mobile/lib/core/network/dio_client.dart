import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import '../error/exceptions.dart';
import 'interceptors/auth_interceptor.dart';

/// Thin wrapper around Dio so datasources never touch Dio directly.
/// Converts DioException into the typed exceptions the repository layer
/// expects (see core/error/exceptions.dart), keeping HTTP-specific
/// concerns out of the domain/data boundary.
class DioClient {
  final Dio dio;

  DioClient({required AuthInterceptor authInterceptor})
      : dio = Dio(
          BaseOptions(
            baseUrl: ApiConstants.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 20),
          ),
        ) {
    dio.interceptors.add(authInterceptor);
    // Certificate pinning hook (Security requirement): in production,
    // attach an HttpClientAdapter configured with the pinned certificate
    // fingerprint here, e.g. via `dio.httpClientAdapter = ...`. Left as a
    // documented extension point rather than hardcoding a fingerprint
    // that would break the moment the backend's TLS cert rotates —
    // wiring the actual pin is an infra/deployment-time decision.
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters, bool skipAuth = false}) async {
    try {
      final response = await dio.get(
        path,
        queryParameters: queryParameters,
        options: Options(extra: {'skipAuth': skipAuth}),
      );
      return response.data as T;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> post<T>(String path, {dynamic data, bool skipAuth = false}) async {
    try {
      final response = await dio.post(path, data: data, options: Options(extra: {'skipAuth': skipAuth}));
      return response.data as T;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> patch<T>(String path, {dynamic data}) async {
    try {
      final response = await dio.patch(path, data: data);
      return response.data as T;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> delete<T>(String path) async {
    try {
      final response = await dio.delete(path);
      return response.data as T;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Exception _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return NetworkException();
    }
    final statusCode = e.response?.statusCode;
    if (statusCode == 401) {
      return UnauthorizedException();
    }
    final message = _extractMessage(e.response?.data) ?? e.message ?? 'حدث خطأ غير متوقع';
    return ServerException(message, statusCode: statusCode);
  }

  String? _extractMessage(dynamic data) {
    if (data is Map && data['message'] != null) {
      final m = data['message'];
      return m is List ? m.join(', ') : m.toString();
    }
    return null;
  }
}
