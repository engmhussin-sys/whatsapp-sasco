import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/language_entity.dart';

abstract class CompanyLanguagesRepository {
  Future<Either<Failure, List<LanguageEntity>>> getAllLanguages();
  Future<Either<Failure, List<LanguageEntity>>> getEnabledForCompany(String companyId);
  Future<Either<Failure, void>> enable(String companyId, String langCode);
  Future<Either<Failure, void>> disable(String companyId, String langCode);
}
