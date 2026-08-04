import 'package:equatable/equatable.dart';

class ConversationMemberEntity extends Equatable {
  final String userId;
  final String firstName;
  final String lastName;
  final String? avatarUrl;

  const ConversationMemberEntity({required this.userId, required this.firstName, required this.lastName, this.avatarUrl});

  String get fullName => '$firstName $lastName';

  @override
  List<Object?> get props => [userId, firstName, lastName, avatarUrl];
}

enum ConversationType { direct, group, team }

class ConversationEntity extends Equatable {
  final String id;
  final ConversationType type;
  final String? title;
  final List<ConversationMemberEntity> members;
  final String? lastMessagePreview;
  final DateTime updatedAt;
  final int unreadCount;

  const ConversationEntity({
    required this.id,
    required this.type,
    this.title,
    required this.members,
    this.lastMessagePreview,
    required this.updatedAt,
    this.unreadCount = 0,
  });

  String displayName(String currentUserId) {
    if (title != null && title!.isNotEmpty) return title!;
    final other = members.where((m) => m.userId != currentUserId).toList();
    if (other.isEmpty) return 'محادثة';
    return other.first.fullName;
  }

  @override
  List<Object?> get props => [id, type, title, members, lastMessagePreview, updatedAt, unreadCount];
}
