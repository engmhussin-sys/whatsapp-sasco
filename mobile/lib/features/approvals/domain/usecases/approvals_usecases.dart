import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/approval_entity.dart';
import '../repositories/approvals_repository.dart';

class GetMyPendingApprovalsParams extends Equatable {
  final String companyId;
  const GetMyPendingApprovalsParams(this.companyId);
  @override
  List<Object?> get props => [companyId];
}

class GetMyPendingApprovalsUseCase implements UseCase<List<ApprovalEntity>, GetMyPendingApprovalsParams> {
  final ApprovalsRepository repository;
  GetMyPendingApprovalsUseCase(this.repository);
  @override
  Future<Either<Failure, List<ApprovalEntity>>> call(GetMyPendingApprovalsParams params) =>
      repository.getMyPendingApprovals(params.companyId);
}

class ActOnApprovalParams extends Equatable {
  final String companyId;
  final String approvalId;
  final ApprovalActionType action;
  final String? comment;
  const ActOnApprovalParams({required this.companyId, required this.approvalId, required this.action, this.comment});
  @override
  List<Object?> get props => [companyId, approvalId, action, comment];
}

class ActOnApprovalUseCase implements UseCase<ApprovalEntity, ActOnApprovalParams> {
  final ApprovalsRepository repository;
  ActOnApprovalUseCase(this.repository);
  @override
  Future<Either<Failure, ApprovalEntity>> call(ActOnApprovalParams params) =>
      repository.actOnApproval(params.companyId, params.approvalId, params.action, params.comment);
}
