import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/approval_entity.dart';

abstract class ApprovalsRepository {
  Future<Either<Failure, List<ApprovalEntity>>> getMyPendingApprovals(String companyId);
  Future<Either<Failure, ApprovalEntity>> actOnApproval(
    String companyId,
    String approvalId,
    ApprovalActionType action,
    String? comment,
  );
}
