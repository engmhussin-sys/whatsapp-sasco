import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/conversation_entity.dart';
import '../entities/message_attachment_entity.dart';
import '../entities/message_entity.dart';

abstract class ChatRepository {
  Future<Either<Failure, List<ConversationEntity>>> getConversations(String companyId);

  Future<Either<Failure, List<MessageEntity>>> getMessages(String companyId, String conversationId, {String? cursor});

  Future<Either<Failure, MessageEntity>> sendTextMessage(String companyId, String conversationId, String text, {String? replyToId});

  Future<Either<Failure, MessageEntity>> sendVoiceMessage(
    String companyId,
    String conversationId,
    String audioFilePath,
    int durationMs,
  );

  /// Group 2 (WhatsApp parity) — "Delete for everyone". Sender-only,
  /// enforced server-side (see MessagesService.deleteMessage). "Delete
  /// for me" is intentionally NOT here — it's a purely local/client-side
  /// list filter (no server round-trip), handled in ChatBloc directly.
  Future<Either<Failure, void>> deleteMessage(String companyId, String conversationId, String messageId);

  /// Group 3 (WhatsApp parity) — toggle a reaction (same emoji again = remove).
  Future<Either<Failure, void>> reactToMessage(String companyId, String conversationId, String messageId, String emoji);

  /// Group 3 — edits a text message. Returns only {text, editedAt} from
  /// the server (see ChatRepositoryImpl doc comment for why) — callers
  /// must merge this into their existing local copy of the message
  /// rather than replacing it wholesale.
  Future<Either<Failure, ({String text, DateTime editedAt})>> editMessage(
    String companyId,
    String conversationId,
    String messageId,
    String newText,
  );

  /// Images/documents: creates a message (with [caption] as its text —
  /// backend has no separate "media-only" message shape) then uploads
  /// the file as that message's attachment. Two real network calls
  /// under the hood, matching exactly how the backend is built (an
  /// attachment always belongs to an EXISTING message).
  Future<Either<Failure, MessageEntity>> sendAttachment(
    String companyId,
    String conversationId, {
    required String filePath,
    required MessageAttachmentKind kind,
    String? caption,
  });

  Future<Either<Failure, void>> markRead(String companyId, String conversationId, {String? upToMessageId});

  /// T5 "إعادة ترجمة" — backfills translations for this user's new
  /// language across older messages in the conversation (translations
  /// are otherwise only generated at send-time).
  Future<Either<Failure, void>> retranslateConversation(String companyId, String conversationId, String targetLanguage);

  // ---- Real-time (WebSocket) -----------------------------------------------
  Future<void> connectRealtime();
  void disconnectRealtime();
  void joinConversation(String conversationId);
  void leaveConversation(String conversationId);
  void sendTypingIndicator(String conversationId, bool isTyping);
  Stream<MessageEntity> get onMessageReceived;
  Stream<Map<String, dynamic>> get onNotification;
  Stream<Map<String, dynamic>> get onTypingChanged;
  Stream<String> get onMessagesReadByPeer;
}
