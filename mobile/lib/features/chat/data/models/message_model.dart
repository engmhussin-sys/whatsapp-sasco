import '../../domain/entities/message_entity.dart';

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
