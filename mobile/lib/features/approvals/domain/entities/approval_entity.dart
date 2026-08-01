import 'package:equatable/equatable.dart';

enum ApprovalStatus { pending, approved, rejected, returned, canceled, completed }
enum ApprovalActionType { approve, reject, returnAction, comment }

ApprovalStatus approvalStatusFromString(String v) {
  const map = {
    'PENDING': ApprovalStatus.pending,
    'APPROVED': ApprovalStatus.approved,
    'REJECTED': ApprovalStatus.rejected,
    'RETURNED': ApprovalStatus.returned,
    'CANCELED': ApprovalStatus.canceled,
    'COMPLETED': ApprovalStatus.completed,
  };
  return map[v] ?? ApprovalStatus.pending;
}

class ApprovalStepEntity extends Equatable {
  final int stepOrder;
  final String name;
  final String approverRoleName;
  const ApprovalStepEntity({required this.stepOrder, required this.name, required this.approverRoleName});
  @override
  List<Object?> get props => [stepOrder, name, approverRoleName];
}

class ApprovalActionEntity extends Equatable {
  final int stepOrder;
  final String actorId;
  final String action;
  final String? comment;
  final DateTime createdAt;
  const ApprovalActionEntity({
    required this.stepOrder,
    required this.actorId,
    required this.action,
    this.comment,
    required this.createdAt,
  });
  @override
  List<Object?> get props => [stepOrder, actorId, action, comment, createdAt];
}

class ApprovalEntity extends Equatable {
  final String id;
  final int currentStep;
  final ApprovalStatus status;
  final List<ApprovalStepEntity> steps;
  final List<ApprovalActionEntity> actions;

  const ApprovalEntity({
    required this.id,
    required this.currentStep,
    required this.status,
    required this.steps,
    required this.actions,
  });

  ApprovalStepEntity? get currentStepDef =>
      steps.where((s) => s.stepOrder == currentStep).isEmpty ? null : steps.firstWhere((s) => s.stepOrder == currentStep);

  @override
  List<Object?> get props => [id, currentStep, status, steps, actions];
}
