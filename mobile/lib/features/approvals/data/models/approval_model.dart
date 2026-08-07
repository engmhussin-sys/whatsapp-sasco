import '../../domain/entities/approval_entity.dart';

class ApprovalModel extends ApprovalEntity {
  const ApprovalModel({
    required super.id,
    required super.currentStep,
    required super.status,
    required super.steps,
    required super.actions,
  });

  factory ApprovalModel.fromJson(Map<String, dynamic> json) {
    final flow = json['flow'] as Map<String, dynamic>;
    final steps = (flow['steps'] as List<dynamic>).map((s) {
      final map = s as Map<String, dynamic>;
      return ApprovalStepEntity(
        stepOrder: map['stepOrder'] as int,
        name: map['name'] as String,
        approverRoleName: (map['approverRole'] as Map<String, dynamic>)['name'] as String,
      );
    }).toList();

    final actions = (json['actions'] as List<dynamic>? ?? []).map((a) {
      final map = a as Map<String, dynamic>;
      return ApprovalActionEntity(
        stepOrder: map['stepOrder'] as int,
        actorId: map['actorId'] as String,
        action: map['action'] as String,
        comment: map['comment'] as String?,
        createdAt: DateTime.parse(map['createdAt'] as String).toLocal(),
      );
    }).toList();

    return ApprovalModel(
      id: json['id'] as String,
      currentStep: json['currentStep'] as int,
      status: approvalStatusFromString(json['status'] as String),
      steps: steps,
      actions: actions,
    );
  }
}
