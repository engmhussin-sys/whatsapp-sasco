import 'package:flutter/material.dart';
import '../../domain/entities/message_entity.dart';
import 'voice_message_player.dart';

class MessageBubble extends StatelessWidget {
  final MessageEntity message;
  final bool isMine;

  const MessageBubble({super.key, required this.message, required this.isMine});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMine ? Alignment.centerLeft : Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: isMine ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (message.type == MessageType.voice && message.audioUrl != null)
              VoiceMessagePlayer(audioUrl: message.audioUrl!, isMine: isMine)
            else
              Text(message.text ?? '', style: TextStyle(color: isMine ? Colors.white : Colors.black87)),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(message.createdAt),
                  style: TextStyle(fontSize: 10, color: isMine ? Colors.white70 : Colors.black45),
                ),
                if (isMine) ...[
                  const SizedBox(width: 4),
                  Icon(_statusIcon(message.status), size: 12, color: Colors.white70),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

  IconData _statusIcon(MessageDeliveryStatus status) {
    switch (status) {
      case MessageDeliveryStatus.read:
        return Icons.done_all;
      case MessageDeliveryStatus.delivered:
        return Icons.done_all;
      case MessageDeliveryStatus.sent:
        return Icons.done;
    }
  }
}
