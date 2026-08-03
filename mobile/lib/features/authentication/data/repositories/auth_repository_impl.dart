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
    }
  }

  @override
  Future<Either<Failure, UserEntity?>> getCurrentUser() async {
    try {
      // ignore: avoid_print
      print('🔍 [TRACE] AuthRepositoryImpl.getCurrentUser — before getAccessToken()');
      final token = await _secureStorage.getAccessToken();
      // ignore: avoid_print
      print('🔍 [TRACE] AuthRepositoryImpl.getCurrentUser — after getAccessToken(), token=${token != null}');
      if (token == null) return const Right(null);
      // ignore: avoid_print
      print('🔍 [TRACE] AuthRepositoryImpl.getCurrentUser — before getUser()');
      final userJson = await _secureStorage.getUser();
      // ignore: avoid_print
      print('🔍 [TRACE] AuthRepositoryImpl.getCurrentUser — after getUser(), found=${userJson != null}');
      if (userJson == null) return const Right(null);
      return Right(UserModel.fromJson(userJson));
    } catch (e, st) {
      // ignore: avoid_print
      print('🔍 [TRACE] AuthRepositoryImpl.getCurrentUser — CAUGHT EXCEPTION: $e\n$st');
      return const Left(CacheFailure());
    }
  }
}
