import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class RequestPasswordResetParams extends Equatable {
  final String email;
  const RequestPasswordResetParams(this.email);
  @override
  List<Object?> get props => [email];
}

class RequestPasswordResetUseCase implements UseCase<void, RequestPasswordResetParams> {
  final AuthRepository repository;
  RequestPasswordResetUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(RequestPasswordResetParams params) =>
      repository.requestPasswordReset(params.email);
}
