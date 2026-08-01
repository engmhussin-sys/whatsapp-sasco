import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/approval_entity.dart';
import '../../domain/repositories/approvals_repository.dart';
import '../datasources/approvals_remote_data_source.dart';

class ApprovalsRepositoryImpl implements ApprovalsRepository {
  final ApprovalsRemoteDataSource _remote;
  ApprovalsRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<ApprovalEntity>>> getMyPendingApprovals(String companyId) async {
    try {
      return Right(await _remote.getMyPendingApprovals(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, ApprovalEntity>> actOnApproval(
    String companyId,
    String approvalId,
    ApprovalActionType action,
    String? comment,
  ) async {
    try {
      return Right(await _remote.act(companyId, approvalId, action, comment));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }
}
