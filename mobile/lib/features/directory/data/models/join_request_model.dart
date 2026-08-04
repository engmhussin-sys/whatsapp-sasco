import '../../domain/entities/join_request_entity.dart';

class JoinRequestModel extends JoinRequestEntity {
  const JoinRequestModel({
    required super.id,
    required super.requesterId,
    required super.requesterName,
    super.requesterAvatarUrl,
    required super.createdAt,
  });

  factory JoinRequestModel.fromJson(Map<String, dynamic> json) {
    final requester = json['requester'] as Map<String, dynamic>? ?? {};
    return JoinRequestModel(
      id: json['id'] as String,
      requesterId: json['requesterId'] as String,
      requesterName: '${requester['firstName'] ?? ''} ${requester['lastName'] ?? ''}'.trim(),
      requesterAvatarUrl: requester['avatarUrl'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
