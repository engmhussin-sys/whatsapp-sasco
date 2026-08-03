import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../models/user_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remote;
  final SecureStorageService _secureStorage;
  final NetworkInfo _networkInfo;

  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required SecureStorageService secureStorage,
    required NetworkInfo networkInfo,
  })  : _remote = remote,
        _secureStorage = secureStorage,
        _networkInfo = networkInfo;

  @override
  Future<Either<Failure, UserEntity>> login({
    required String email,
    required String password,
    String? companyId,
  }) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final tokens = await _remote.login(email: email, password: password, companyId: companyId);
      await _secureStorage.saveSession(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: tokens.user.toJson(),
      );
      return Right(tokens.user);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ValidationException catch (e) {
      return Left(ValidationFailure(e.message));
    } catch (e) {
      // Safety net: ANY other exception type (parsing errors, unexpected
      // Dio internals, etc.) must still resolve to a Failure — letting
      // an exception escape this method uncaught left AuthBloc's
      // isSubmitting stuck at true forever (the handler's Future never
      // reaches its `emit(isSubmitting: false)` call), which is exactly
      // the confirmed symptom this fix addresses.
      return Left(ServerFailure('حدث خطأ غير متوقَّع أثناء تسجيل الدخول: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    final refreshToken = await _secureStorage.getRefreshToken();
    try {
      if (refreshToken != null && await _networkInfo.isConnected) {
        await _remote.logout(refreshToken);
      }
    } catch (_) {
      // best-effort — proceed with local logout regardless
    }
    await _secureStorage.clearSession();
    return const Right(null);
  }

  @override
  Future<Either<Failure, void>> requestPasswordReset(String email) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.requestPasswordReset(email);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('حدث خطأ غير متوقَّع: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> resetPassword({required String resetToken, required String newPassword}) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.resetPassword(resetToken: resetToken, newPassword: newPassword);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('حدث خطأ غير متوقَّع: $e'));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> updatePreferredLanguage(String languageCode) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final currentUserJson = await _secureStorage.getUser();
      if (currentUserJson == null) return const Left(CacheFailure());
      final current = UserModel.fromJson(currentUserJson);
      if (current.companyId == null) {
        return const Left(ServerFailure('لا يمكن تغيير اللغة لحساب مدير المنصة من هنا'));
      }
      final updated = await _remote.updatePreferredLanguage(
        companyId: current.companyId!,
        userId: current.id,
        languageCode: languageCode,
      );
      await _secureStorage.updateUser(updated.toJson());
      return Right(updated);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on UnauthorizedException catch (e) {
      return Left(UnauthorizedFailure(e.message));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر تحديث اللغة: $e'));
    }
  }

  @override
  Future<Either<Failure, UserEntity?>> getCurrentUser() async {
    try {
      final token = await _secureStorage.getAccessToken();
      if (token == null) return const Right(null);
      final userJson = await _secureStorage.getUser();
      if (userJson == null) return const Right(null);
      return Right(UserModel.fromJson(userJson));
    } catch (_) {
      return const Left(CacheFailure());
    }
  }
}
