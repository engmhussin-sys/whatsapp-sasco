/// Thrown by the data layer (datasources). Never leaks past the
/// repository boundary — repositories catch these and convert them to
/// [Failure] values (see failures.dart) returned via Either, per Clean
/// Architecture conventions.
class ServerException implements Exception {
  final String message;
  final int? statusCode;
  ServerException(this.message, {this.statusCode});
}

class NetworkException implements Exception {
  final String message;
  NetworkException([this.message = 'لا يوجد اتصال بالإنترنت']);
}

class CacheException implements Exception {
  final String message;
  CacheException([this.message = 'خطأ في التخزين المحلي']);
}

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException([this.message = 'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا']);
}

class ValidationException implements Exception {
  final String message;
  ValidationException(this.message);
}
