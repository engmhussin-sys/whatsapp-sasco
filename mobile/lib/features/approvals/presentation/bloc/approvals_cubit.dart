import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/approval_entity.dart';
import '../../domain/usecases/approvals_usecases.dart';

enum ApprovalsStatus { initial, loading, success, failure }

class ApprovalsState extends Equatable {
  final ApprovalsStatus status;
  final List<ApprovalEntity> approvals;
  final String? errorMessage;
  final String? actingOnId;

  const ApprovalsState({this.status = ApprovalsStatus.initial, this.approvals = const [], this.errorMessage, this.actingOnId});

  ApprovalsState copyWith({
    ApprovalsStatus? status,
    List<ApprovalEntity>? approvals,
    String? errorMessage,
    String? actingOnId,
    bool clearActingOnId = false,
  }) {
    return ApprovalsState(
      status: status ?? this.status,
      approvals: approvals ?? this.approvals,
      errorMessage: errorMessage,
      actingOnId: clearActingOnId ? null : (actingOnId ?? this.actingOnId),
    );
  }

  @override
  List<Object?> get props => [status, approvals, errorMessage, actingOnId];
}

class ApprovalsCubit extends Cubit<ApprovalsState> {
  final GetMyPendingApprovalsUseCase _getMyPendingApprovals;
  final ActOnApprovalUseCase _actOnApproval;
  final String companyId;

  ApprovalsCubit({
    required GetMyPendingApprovalsUseCase getMyPendingApprovals,
    required ActOnApprovalUseCase actOnApproval,
    required this.companyId,
  })  : _getMyPendingApprovals = getMyPendingApprovals,
        _actOnApproval = actOnApproval,
        super(const ApprovalsState());

  Future<void> load() async {
    emit(state.copyWith(status: ApprovalsStatus.loading));
    final result = await _getMyPendingApprovals(GetMyPendingApprovalsParams(companyId));
    result.fold(
      (failure) => emit(state.copyWith(status: ApprovalsStatus.failure, errorMessage: failure.message)),
      (approvals) => emit(state.copyWith(status: ApprovalsStatus.success, approvals: approvals)),
    );
  }

  Future<void> act(String approvalId, ApprovalActionType action, {String? comment}) async {
    emit(state.copyWith(actingOnId: approvalId));
    final result = await _actOnApproval(
      ActOnApprovalParams(companyId: companyId, approvalId: approvalId, action: action, comment: comment),
    );
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message, clearActingOnId: true)),
      (_) {
        emit(state.copyWith(clearActingOnId: true));
        load(); // refresh the pending list — the acted-on item should now disappear
      },
    );
  }
}
