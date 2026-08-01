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
  NetworkException([this.message = 'No internet connection']);
}

class CacheException implements Exception {
  final String message;
  CacheException([this.message = 'Local cache error']);
}

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException([this.message = 'Session expired']);
}

class ValidationException implements Exception {
  final String message;
  ValidationException(this.message);
}
