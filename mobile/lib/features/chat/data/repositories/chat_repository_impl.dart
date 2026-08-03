import 'package:dartz/dartz.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../../../core/storage/offline_queue.dart';
import '../../domain/entities/conversation_entity.dart';
import '../../domain/entities/message_attachment_entity.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../datasources/chat_remote_data_source.dart';
import '../datasources/chat_socket_data_source.dart';
import '../models/message_model.dart';

class ChatRepositoryImpl implements ChatRepository {
  final ChatRemoteDataSource _remote;
  final ChatSocketDataSource _socket;
  final NetworkInfo _networkInfo;
  final OfflineQueueService _offlineQueue;

  ChatRepositoryImpl({
    required ChatRemoteDataSource remote,
    required ChatSocketDataSource socket,
    required NetworkInfo networkInfo,
    required OfflineQueueService offlineQueue,
  })  : _remote = remote,
        _socket = socket,
        _networkInfo = networkInfo,
        _offlineQueue = offlineQueue;

  @override
  Future<Either<Failure, List<ConversationEntity>>> getConversations(String companyId) async {
    try {
      final result = await _remote.getConversations(companyId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, List<MessageEntity>>> getMessages(String companyId, String conversationId, {String? cursor}) async {
    try {
      final result = await _remote.getMessages(companyId, conversationId, cursor: cursor);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, MessageEntity>> sendTextMessage(String companyId, String conversationId, String text, {String? replyToId}) async {
    // REFERENCE IMPLEMENTATION for the offline-queue pattern (see
    // core/storage/offline_queue.dart doc comment): if there's no
    // connectivity, the write is queued instead of failing outright.
    // The caller (ChatBloc) still needs to handle the "queued, not yet
    // confirmed" case in its UI state — this only guarantees the write
    // isn't silently lost.
    if (!await _networkInfo.isConnected) {
      await _offlineQueue.enqueue(
        method: 'POST',
        path: ApiConstants.sendTextMessage(companyId, conversationId),
        body: {'text': text, if (replyToId != null) 'replyToId': replyToId},
      );
      return const Left(NetworkFailure('لا يوجد اتصال — تم حفظ الرسالة وستُرسَل تلقائيًا عند عودة الاتصال'));
    }

    try {
      final result = await _remote.sendTextMessage(companyId, conversationId, text, replyToId: replyToId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, MessageEntity>> sendVoiceMessage(
    String companyId,
    String conversationId,
    String audioFilePath,
    int durationMs,
  ) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('لا يوجد اتصال — أعد المحاولة عند عودة الشبكة'));
    }
    try {
      final result = await _remote.sendVoiceMessage(companyId, conversationId, audioFilePath, durationMs);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, MessageEntity>> sendAttachment(
    String companyId,
    String conversationId, {
    required String filePath,
    required MessageAttachmentKind kind,
    String? caption,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure('لا يوجد اتصال — أعد المحاولة عند عودة الشبكة'));
    }
    try {
      // Step 1: create the message that will carry the attachment. The
      // backend has no "media with no text" shape, so an empty caption
      // becomes a short default label rather than an empty string (a
      // blank bubble reads as broken, not intentional).
      final captionText = (caption == null || caption.trim().isEmpty) ? _defaultCaptionFor(kind) : caption.trim();
      final message = await _remote.sendTextMessage(companyId, conversationId, captionText);

      // Step 2: attach the file to that message.
      final attachment = await _remote.uploadAttachment(companyId, conversationId, message.id, filePath, kind);

      return Right(MessageModel(
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.senderName,
        type: message.type,
        status: message.status,
        text: message.text,
        createdAt: message.createdAt,
        originalLang: message.originalLang,
        translations: message.translations,
        attachments: [attachment],
      ));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  String _defaultCaptionFor(MessageAttachmentKind kind) => switch (kind) {
        MessageAttachmentKind.image => '📷 صورة',
        MessageAttachmentKind.video => '🎥 فيديو',
        MessageAttachmentKind.document => '📄 مستند',
        MessageAttachmentKind.audio => '🎵 صوت',
        MessageAttachmentKind.signature => '✍️ توقيع',
      };

  @override
  Future<Either<Failure, void>> markRead(String companyId, String conversationId, {String? upToMessageId}) async {
    try {
      await _remote.markRead(companyId, conversationId, upToMessageId: upToMessageId);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, void>> retranslateConversation(String companyId, String conversationId, String targetLanguage) async {
    try {
      await _remote.retranslateConversation(companyId, conversationId, targetLanguage);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, void>> deleteMessage(String companyId, String conversationId, String messageId) async {
    try {
      await _remote.deleteMessage(companyId, conversationId, messageId);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  // ---- Real-time -------------------------------------------------------------

  @override
  Future<void> connectRealtime() => _socket.connect();

  @override
  void disconnectRealtime() => _socket.disconnect();

  @override
  void joinConversation(String conversationId) => _socket.joinConversation(conversationId);

  @override
  void leaveConversation(String conversationId) => _socket.leaveConversation(conversationId);

  @override
  void sendTypingIndicator(String conversationId, bool isTyping) => _socket.sendTyping(conversationId, isTyping);

  @override
  Stream<MessageEntity> get onMessageReceived => _socket.onNewMessage;

  @override
  Stream<Map<String, dynamic>> get onTypingChanged => _socket.onTyping;

  @override
  Stream<String> get onMessagesReadByPeer => _socket.onMessageRead.map((e) => e['userId'] as String);
}
