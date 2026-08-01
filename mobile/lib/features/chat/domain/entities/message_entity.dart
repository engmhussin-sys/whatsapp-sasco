import 'package:equatable/equatable.dart';

enum MessageType { text, voice, system }
enum MessageDeliveryStatus { sent, delivered, read }

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
  });

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
      );

  @override
  List<Object?> get props => [id, conversationId, senderId, type, status, text, audioUrl, createdAt];
}
