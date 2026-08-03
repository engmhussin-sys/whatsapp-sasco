import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/directory_user_entity.dart';

abstract class DirectoryRepository {
  Future<Either<Failure, List<DirectoryUserEntity>>> searchUsers(String companyId, {String? search});
}
