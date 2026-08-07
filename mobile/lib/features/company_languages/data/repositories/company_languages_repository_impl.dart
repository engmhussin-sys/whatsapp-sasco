import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../domain/entities/language_entity.dart';
import '../../domain/repositories/company_languages_repository.dart';
import '../datasources/company_languages_remote_data_source.dart';

class CompanyLanguagesRepositoryImpl implements CompanyLanguagesRepository {
  final CompanyLanguagesRemoteDataSource _remote;
  final NetworkInfo _networkInfo;
  CompanyLanguagesRepositoryImpl(this._remote, this._networkInfo);

  @override
  Future<Either<Failure, List<LanguageEntity>>> getAllLanguages() async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      return Right(await _remote.fetchAllLanguages());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر جلب قائمة اللغات: $e'));
    }
  }

  @override
  Future<Either<Failure, List<LanguageEntity>>> getEnabledForCompany(String companyId) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      return Right(await _remote.fetchEnabledForCompany(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر جلب لغات الشركة: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> enable(String companyId, String langCode) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.enable(companyId, langCode);
      return const Right(null);
    } on ServerException catch (e) {
      // 409: اللغة مُفعَّلة بالفعل — ليست خطأً فادحاً من منظور المستخدم،
      // لكن نُبلغه برسالة واضحة بدل رسالة خادم عامة.
      if (e.statusCode == 409) return const Left(ServerFailure('هذه اللغة مُفعَّلة بالفعل', statusCode: 409));
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر تفعيل اللغة: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> disable(String companyId, String langCode) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.disable(companyId, langCode);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر إلغاء تفعيل اللغة: $e'));
    }
  }
}
