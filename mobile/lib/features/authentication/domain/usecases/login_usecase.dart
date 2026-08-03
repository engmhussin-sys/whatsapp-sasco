import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class LoginParams extends Equatable {
  final String? email;
  final String? phone;
  final String password;
  final String? companyId;
  const LoginParams({this.email, this.phone, required this.password, this.companyId});

  @override
  List<Object?> get props => [email, phone, password, companyId];
}

class LoginUseCase implements UseCase<UserEntity, LoginParams> {
  final AuthRepository repository;
  LoginUseCase(this.repository);

  @override
  Future<Either<Failure, UserEntity>> call(LoginParams params) {
    return repository.login(email: params.email, phone: params.phone, password: params.password, companyId: params.companyId);
  }
}
