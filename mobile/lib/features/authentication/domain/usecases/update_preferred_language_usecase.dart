import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class UpdatePreferredLanguageUseCase implements UseCase<UserEntity, String> {
  final AuthRepository repository;
  UpdatePreferredLanguageUseCase(this.repository);

  @override
  Future<Either<Failure, UserEntity>> call(String languageCode) => repository.updatePreferredLanguage(languageCode);
}
