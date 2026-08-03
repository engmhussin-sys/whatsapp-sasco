import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../domain/entities/directory_user_entity.dart';
import '../../domain/repositories/directory_repository.dart';
import '../datasources/directory_remote_data_source.dart';

class DirectoryRepositoryImpl implements DirectoryRepository {
  final DirectoryRemoteDataSource _remote;
  final NetworkInfo _networkInfo;

  DirectoryRepositoryImpl({required DirectoryRemoteDataSource remote, required NetworkInfo networkInfo})
      : _remote = remote,
        _networkInfo = networkInfo;

  @override
  Future<Either<Failure, List<DirectoryUserEntity>>> searchUsers(String companyId, {String? search}) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final result = await _remote.searchUsers(companyId, search: search);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر البحث عن المستخدمين: $e'));
    }
  }
}
