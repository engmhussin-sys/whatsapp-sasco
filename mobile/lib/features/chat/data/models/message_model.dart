import '../../domain/entities/message_entity.dart';
import 'message_attachment_model.dart';

class MessageModel extends MessageEntity {
  const MessageModel({
    required super.id,
    required super.conversationId,
    required super.senderId,
    required super.senderName,
    required super.type,
    required super.status,
    super.text,
    super.audioUrl,
    super.audioDurationMs,
    required super.createdAt,
    super.originalLang,
    super.translations,
    super.attachments,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    return MessageModel(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String? ?? '',
      senderId: json['senderId'] as String,
      senderName: sender != null ? '${sender['firstName']} ${sender['lastName']}' : '',
      type: _typeFromString(json['type'] as String),
      status: _statusFromString(json['status'] as String),
      text: json['originalText'] as String?,
      audioUrl: json['audioUrl'] as String?,
      audioDurationMs: json['audioDurationMs'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      originalLang: json['originalLang'] as String? ?? 'ar',
      translations: {
        for (final t in (json['translations'] as List<dynamic>? ?? const []))
          (t as Map<String, dynamic>)['langCode'] as String: (t['translatedText'] as String?) ?? '',
      },
      attachments: (json['attachments'] as List<dynamic>? ?? const [])
          .map((a) => MessageAttachmentModel.fromJson(a as Map<String, dynamic>))
          .toList(),
    );
  }

  static MessageType _typeFromString(String v) => v == 'VOICE'
      ? MessageType.voice
      : v == 'SYSTEM'
          ? MessageType.system
          : MessageType.text;

  static MessageDeliveryStatus _statusFromString(String v) =>
      v == 'READ' ? MessageDeliveryStatus.read : v == 'DELIVERED' ? MessageDeliveryStatus.delivered : MessageDeliveryStatus.sent;
}
