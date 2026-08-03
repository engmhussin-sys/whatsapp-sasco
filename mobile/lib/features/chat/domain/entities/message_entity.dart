import 'package:equatable/equatable.dart';
import 'message_attachment_entity.dart';

enum MessageType { text, voice, system }
enum MessageDeliveryStatus { sent, delivered, read }

/// Group 2 (WhatsApp parity) — lightweight quoted-preview of the message
/// being replied to. Deliberately NOT the full MessageEntity (avoids
/// unbounded reply-chain nesting problems) — just enough to render the
/// quote block: who said it, and what.
class ReplyPreview extends Equatable {
  final String messageId;
  final String senderName;
  final String? text;

  const ReplyPreview({required this.messageId, required this.senderName, this.text});

  @override
  List<Object?> get props => [messageId, senderName, text];
}

class MessageEntity extends Equatable {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final MessageType type;
  final MessageDeliveryStatus status;
  final String? text;
  final String? audioUrl;
  final int? audioDurationMs;
  final DateTime createdAt;
  final List<MessageAttachmentEntity> attachments;
  final ReplyPreview? replyTo;

  /// Group 3 (WhatsApp parity) — userId -> emoji. One reaction per user
  /// per message, mirrors the backend's compound-unique constraint
  /// exactly, so this map can never represent an invalid state.
  final Map<String, String> reactions;

  /// Group 3 — non-null once the sender has edited this message's text.
  /// The bubble shows a small "تم التعديل" label when set.
  final DateTime? editedAt;

  /// Group 2 (WhatsApp parity) — "Delete for everyone" tombstone flag. When true, `text`/
  /// `audioUrl` are already blanked server-side; the bubble renders a
  /// "🚫 هذه الرسالة حُذفت" placeholder instead of any content.
  final bool isDeletedForEveryone;

  /// Language the sender actually wrote in — 'ar' | 'ur' | 'hi' | 'bn' | 'en' | 'tl' | 'am' | ...
  final String originalLang;

  /// Server-produced translations, keyed by language code -> translated text.
  /// Populated entirely by the backend's Translation Engine (see
  /// MessagesService.fanOutTranslations) — never written to or computed
  /// on-device; this field is pass-through storage only.
  final Map<String, String> translations;

  const MessageEntity({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.type,
    required this.status,
    this.text,
    this.audioUrl,
    this.audioDurationMs,
    required this.createdAt,
    this.originalLang = 'ar',
    this.translations = const {},
    this.attachments = const [],
    this.replyTo,
    this.isDeletedForEveryone = false,
    this.reactions = const {},
    this.editedAt,
  });

  /// The text the CURRENT user should see: their language's translation if
  /// one exists, otherwise the original as-written text. This is the ONLY
  /// place this decision is made — widgets must call this, not
  /// re-implement the fallback logic themselves.
  String displayText(String myLang) => myLang == originalLang ? (text ?? '') : (translations[myLang] ?? text ?? '');

  /// True when what displayText() returns is an actual translation (not a
  /// same-language passthrough or a same-original fallback) — determines
  /// whether the UI shows the "original text" row underneath.
  bool isTranslatedFor(String myLang) => myLang != originalLang && translations.containsKey(myLang);

  /// True when the user's language differs from the original AND no
  /// translation has arrived for it yet (e.g. still processing, or the
  /// Translation Engine had no provider configured) — the UI shows a
  /// gentle "translation unavailable" notice rather than silently
  /// falling back with no explanation.
  bool translationMissingFor(String myLang) => myLang != originalLang && !translations.containsKey(myLang);

  /// Group 3 — reactions grouped by emoji -> count, for the summary row
  /// below a bubble (e.g. "❤️ 2 · 👍 1"), computed from the raw userId
  /// map rather than duplicated server-side.
  Map<String, int> get reactionCounts {
    final counts = <String, int>{};
    for (final emoji in reactions.values) {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
    }
    return counts;
  }

  String? reactionOf(String userId) => reactions[userId];

  MessageEntity copyWith({MessageDeliveryStatus? status}) => MessageEntity(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        senderName: senderName,
        type: type,
        status: status ?? this.status,
        text: text,
        audioUrl: audioUrl,
        audioDurationMs: audioDurationMs,
        createdAt: createdAt,
        originalLang: originalLang,
        translations: translations,
        attachments: attachments,
        replyTo: replyTo,
        isDeletedForEveryone: isDeletedForEveryone,
        reactions: reactions,
        editedAt: editedAt,
      );

  @override
  List<Object?> get props => [
        id,
        conversationId,
        senderId,
        type,
        status,
        text,
        audioUrl,
        createdAt,
        originalLang,
        translations,
        attachments,
        replyTo,
        isDeletedForEveryone,
        reactions,
        editedAt,
      ];
}
