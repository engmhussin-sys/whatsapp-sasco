import 'package:equatable/equatable.dart';

/// Domain-layer representation of an error. UseCases/Repositories return
/// `Either<Failure, T>` (via package:dartz) rather than throwing, so the
/// presentation layer (Bloc) can pattern-match failures without try/catch
/// scattered across the UI.
abstract class Failure extends Equatable {
  final String message;
  const Failure(this.message);

  @override
  List<Object?> get props => [message];
}

class ServerFailure extends Failure {
  final int? statusCode;
  const ServerFailure(super.message, {this.statusCode});
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'لا يوجد اتصال بالإنترنت']);
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'خطأ في التخزين المحلي']);
}

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure([super.message = 'انتهت صلاحية الجلسة']);
}

class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}
