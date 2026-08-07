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
  /// PROMPT_ROUND6.md §C-1: كانت آخر رسالة تُعرض كنصها الأصلي دائماً
  /// (originalText مباشرة) بصرف النظر عن لغة القارئ — الخادم يُرسِل
  /// translations كاملة أصلاً لآخر رسالة (conversations.service.ts:
  /// messages: { take:1, include: { translations: true } }) لكن
  /// الموبايل كان يتجاهلها تماماً. هذان الحقلان يحملانها الآن.
  final String? lastMessageOriginalLang;
  final Map<String, String> lastMessageTranslations;
  final DateTime updatedAt;
  final int unreadCount;

  const ConversationEntity({
    required this.id,
    required this.type,
    this.title,
    required this.members,
    this.lastMessagePreview,
    this.lastMessageOriginalLang,
    this.lastMessageTranslations = const {},
    required this.updatedAt,
    this.unreadCount = 0,
  });

  String displayName(String currentUserId) {
    if (title != null && title!.isNotEmpty) return title!;
    final other = members.where((m) => m.userId != currentUserId).toList();
    if (other.isEmpty) return 'محادثة';
    return other.first.fullName;
  }

  /// نفس منطق MessageEntity.displayText(myLang) بالضبط — آخر رسالة يجب
  /// أن تمرّ على نفس منطق الترجمة الذي تمرّ عليه أي رسالة داخل المحادثة
  /// نفسها، لا عرض النص الأصلي مباشرة بصرف النظر عن لغة القارئ.
  String lastMessageDisplayText(String myLang) {
    if (lastMessagePreview == null) return '';
    if (lastMessageOriginalLang == null || myLang == lastMessageOriginalLang) return lastMessagePreview!;
    return lastMessageTranslations[myLang] ?? lastMessagePreview!;
  }

  @override
  List<Object?> get props =>
      [id, type, title, members, lastMessagePreview, lastMessageOriginalLang, lastMessageTranslations, updatedAt, unreadCount];
}
