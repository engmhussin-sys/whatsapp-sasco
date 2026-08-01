import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class ResetPasswordParams extends Equatable {
  final String resetToken;
  final String newPassword;
  const ResetPasswordParams({required this.resetToken, required this.newPassword});
  @override
  List<Object?> get props => [resetToken, newPassword];
}

class ResetPasswordUseCase implements UseCase<void, ResetPasswordParams> {
  final AuthRepository repository;
  ResetPasswordUseCase(this.repository);

  @override
  Future<Either<Failure, void>> call(ResetPasswordParams params) =>
      repository.resetPassword(resetToken: params.resetToken, newPassword: params.newPassword);
}
