import 'package:equatable/equatable.dart';

class JoinRequestEntity extends Equatable {
  final String id;
  final String requesterId;
  final String requesterName;
  final String? requesterAvatarUrl;
  final DateTime createdAt;

  const JoinRequestEntity({
    required this.id,
    required this.requesterId,
    required this.requesterName,
    this.requesterAvatarUrl,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id, requesterId, requesterName, requesterAvatarUrl, createdAt];
}
