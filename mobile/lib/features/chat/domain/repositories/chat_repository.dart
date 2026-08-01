import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/conversation_entity.dart';
import '../entities/message_entity.dart';

abstract class ChatRepository {
  Future<Either<Failure, List<ConversationEntity>>> getConversations(String companyId);

  Future<Either<Failure, List<MessageEntity>>> getMessages(String companyId, String conversationId, {String? cursor});

  Future<Either<Failure, MessageEntity>> sendTextMessage(String companyId, String conversationId, String text);

  Future<Either<Failure, MessageEntity>> sendVoiceMessage(
    String companyId,
    String conversationId,
    String audioFilePath,
    int durationMs,
  );

  Future<Either<Failure, void>> markRead(String companyId, String conversationId, {String? upToMessageId});

  // ---- Real-time (WebSocket) -----------------------------------------------
  Future<void> connectRealtime();
  void disconnectRealtime();
  void joinConversation(String conversationId);
  void leaveConversation(String conversationId);
  void sendTypingIndicator(String conversationId, bool isTyping);
  Stream<MessageEntity> get onMessageReceived;
  Stream<Map<String, dynamic>> get onTypingChanged;
  Stream<String> get onMessagesReadByPeer;
}
