import '../../domain/entities/conversation_entity.dart';

class ConversationModel extends ConversationEntity {
  const ConversationModel({
    required super.id,
    required super.type,
    super.title,
    required super.members,
    super.lastMessagePreview,
    required super.updatedAt,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    final members = (json['members'] as List<dynamic>? ?? [])
        .map((m) => ConversationMemberEntity(
              userId: m['userId'] as String,
              firstName: m['user']['firstName'] as String,
              lastName: m['user']['lastName'] as String,
              avatarUrl: m['user']['avatarUrl'] as String?,
            ))
        .toList();

    final messages = json['messages'] as List<dynamic>?;
    String? preview;
    if (messages != null && messages.isNotEmpty) {
      final last = messages.first as Map<String, dynamic>;
      preview = last['type'] == 'VOICE' ? '🎤 رسالة صوتية' : (last['originalText'] as String?);
    }

    return ConversationModel(
      id: json['id'] as String,
      type: _typeFromString(json['type'] as String),
      title: json['title'] as String?,
      members: members,
      lastMessagePreview: preview,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  static ConversationType _typeFromString(String value) {
    switch (value) {
      case 'GROUP':
        return ConversationType.group;
      case 'TEAM':
        return ConversationType.team;
      default:
        return ConversationType.direct;
    }
  }
}
