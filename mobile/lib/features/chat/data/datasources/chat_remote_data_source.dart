import 'package:dio/dio.dart' as dio;
import 'package:http_parser/http_parser.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/entities/message_attachment_entity.dart' show MessageAttachmentKind;
import '../models/conversation_model.dart';
import '../models/message_attachment_model.dart';
import '../models/message_model.dart';

abstract class ChatRemoteDataSource {
  Future<List<ConversationModel>> getConversations(String companyId);
  Future<ConversationModel> createConversation(
    String companyId, {
    required String type,
    required List<String> memberIds,
    String? title,
  });
  Future<List<MessageModel>> getMessages(String companyId, String conversationId, {String? cursor});
  Future<MessageModel> sendTextMessage(String companyId, String conversationId, String text, {String? replyToId, String? clientMessageId});
  Future<MessageModel> sendVoiceMessage(String companyId, String conversationId, String audioFilePath, int durationMs, {String? clientMessageId});
  /// A1 (real-user review, 2026-08-05): explicit retry when voice
  /// transcription failed — re-triggers the same server-side pipeline.
  Future<void> retryVoiceTranscription(String companyId, String conversationId, String messageId);
  Future<MessageAttachmentModel> uploadAttachment(
    String companyId,
    String conversationId,
    String messageId,
    String filePath,
    MessageAttachmentKind kind,
  );
  Future<void> deleteMessage(String companyId, String conversationId, String messageId);
  Future<void> reactToMessage(String companyId, String conversationId, String messageId, String emoji);
  Future<MessageModel> editMessage(String companyId, String conversationId, String messageId, String newText);
  Future<void> markRead(String companyId, String conversationId, {String? upToMessageId});
  Future<void> retranslateConversation(String companyId, String conversationId, String targetLanguage);
}

class ChatRemoteDataSourceImpl implements ChatRemoteDataSource {
  final DioClient _client;
  ChatRemoteDataSourceImpl(this._client);

  @override
  Future<List<ConversationModel>> getConversations(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.conversations(companyId));
    return data.map((e) => ConversationModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<ConversationModel> createConversation(
    String companyId, {
    required String type,
    required List<String> memberIds,
    String? title,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.conversations(companyId),
      data: {
        'type': type,
        'memberIds': memberIds,
        if (title != null) 'title': title,
      },
    );
    return ConversationModel.fromJson(data);
  }

  @override
  Future<List<MessageModel>> getMessages(String companyId, String conversationId, {String? cursor}) async {
    final data = await _client.get<List<dynamic>>(
      ApiConstants.messages(companyId, conversationId),
      queryParameters: cursor != null ? {'cursor': cursor} : null,
    );
    return data.map((e) => MessageModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<MessageModel> sendTextMessage(String companyId, String conversationId, String text, {String? replyToId, String? clientMessageId}) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.sendTextMessage(companyId, conversationId),
      data: {
        'text': text,
        if (replyToId != null) 'replyToId': replyToId,
        if (clientMessageId != null) 'clientMessageId': clientMessageId,
      },
    );
    return MessageModel.fromJson(data);
  }

  @override
  Future<MessageModel> sendVoiceMessage(
    String companyId,
    String conversationId,
    String audioFilePath,
    int durationMs, {
    String? clientMessageId,
  }) async {
    final formData = dio.FormData.fromMap({
      'audio': await dio.MultipartFile.fromFile(
        audioFilePath,
        filename: 'voice-message.m4a',
        contentType: MediaType('audio', 'mp4'), // matches backend's `mimetype.startsWith('audio/')` check
      ),
      'durationMs': durationMs.toString(),
      if (clientMessageId != null) 'clientMessageId': clientMessageId,
    });
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.sendVoiceMessage(companyId, conversationId),
      data: formData,
    );
    return MessageModel.fromJson(data);
  }

  @override
  Future<void> retryVoiceTranscription(String companyId, String conversationId, String messageId) async {
    await _client.post<Map<String, dynamic>>(
      '${ApiConstants.messages(companyId, conversationId)}/$messageId/retry-transcription',
    );
  }

  @override
  Future<void> markRead(String companyId, String conversationId, {String? upToMessageId}) async {
    await _client.post<dynamic>(
      ApiConstants.markRead(companyId, conversationId),
      data: {'upToMessageId': upToMessageId},
    );
  }

  @override
  Future<void> retranslateConversation(String companyId, String conversationId, String targetLanguage) async {
    await _client.post<dynamic>(
      ApiConstants.retranslateConversation(companyId, conversationId),
      data: {'targetLanguage': targetLanguage},
    );
  }

  @override
  Future<void> deleteMessage(String companyId, String conversationId, String messageId) async {
    await _client.delete<dynamic>(ApiConstants.messageById(companyId, conversationId, messageId));
  }

  @override
  Future<void> reactToMessage(String companyId, String conversationId, String messageId, String emoji) async {
    await _client.post<dynamic>(ApiConstants.messageReactions(companyId, conversationId, messageId), data: {'emoji': emoji});
  }

  @override
  Future<MessageModel> editMessage(String companyId, String conversationId, String messageId, String newText) async {
    final data = await _client.patch<Map<String, dynamic>>(
      ApiConstants.messageById(companyId, conversationId, messageId),
      data: {'text': newText},
    );
    return MessageModel.fromJson(data);
  }

  @override
  Future<MessageAttachmentModel> uploadAttachment(
    String companyId,
    String conversationId,
    String messageId,
    String filePath,
    MessageAttachmentKind kind,
  ) async {
    final formData = dio.FormData.fromMap({
      'file': await dio.MultipartFile.fromFile(filePath),
      'kind': kind.apiValue,
    });
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.messageAttachments(companyId, conversationId, messageId),
      data: formData,
    );
    return MessageAttachmentModel.fromJson(data);
  }
}
