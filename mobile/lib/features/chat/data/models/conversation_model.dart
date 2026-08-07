import '../../domain/entities/conversation_entity.dart';

class ConversationModel extends ConversationEntity {
  const ConversationModel({
    required super.id,
    required super.type,
    super.title,
    required super.members,
    super.lastMessagePreview,
    super.lastMessageOriginalLang,
    super.lastMessageTranslations,
    required super.updatedAt,
    super.unreadCount,
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
    String? lastOriginalLang;
    final lastTranslations = <String, String>{};
    if (messages != null && messages.isNotEmpty) {
      final last = messages.first as Map<String, dynamic>;
      if (last['type'] == 'VOICE') {
        preview = 'رسالة صوتية';
      } else {
        preview = last['originalText'] as String?;
        lastOriginalLang = last['originalLang'] as String?;
        final rawTranslations = last['translations'] as List<dynamic>?;
        if (rawTranslations != null) {
          for (final t in rawTranslations) {
            final map = t as Map<String, dynamic>;
            lastTranslations[map['langCode'] as String] = map['translatedText'] as String;
          }
        }
      }
    }

    return ConversationModel(
      id: json['id'] as String,
      type: _typeFromString(json['type'] as String),
      title: json['title'] as String?,
      members: members,
      lastMessagePreview: preview,
      lastMessageOriginalLang: lastOriginalLang,
      lastMessageTranslations: lastTranslations,
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      unreadCount: json['unreadCount'] as int? ?? 0,
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
