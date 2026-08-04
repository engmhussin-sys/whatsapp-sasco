import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../domain/entities/joinable_group_entity.dart';
import '../../domain/entities/join_request_entity.dart';
import '../../domain/repositories/join_request_repository.dart';
import '../datasources/join_request_remote_data_source.dart';

class JoinRequestRepositoryImpl implements JoinRequestRepository {
  final JoinRequestRemoteDataSource _remote;
  final NetworkInfo _networkInfo;

  JoinRequestRepositoryImpl({required JoinRequestRemoteDataSource remote, required NetworkInfo networkInfo})
      : _remote = remote,
        _networkInfo = networkInfo;

  @override
  Future<Either<Failure, List<JoinableGroupEntity>>> getJoinableGroups(String companyId) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      return Right(await _remote.getJoinableGroups(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر جلب المجموعات المتاحة: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> requestToJoin(String companyId, String conversationId) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.requestToJoin(companyId, conversationId);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر إرسال طلب الانضمام: $e'));
    }
  }

  @override
  Future<Either<Failure, List<JoinRequestEntity>>> getPendingRequests(String companyId, String conversationId) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      return Right(await _remote.getPendingRequests(companyId, conversationId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر جلب طلبات الانضمام: $e'));
    }
  }

  @override
  Future<Either<Failure, void>> decideRequest(String companyId, String requestId, {required bool approve}) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      await _remote.decideRequest(companyId, requestId, approve: approve);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر تحديث حالة الطلب: $e'));
    }
  }
}
