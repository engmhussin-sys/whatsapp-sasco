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
  Future<List<MessageModel>> getMessages(String companyId, String conversationId, {String? cursor});
  Future<MessageModel> sendTextMessage(String companyId, String conversationId, String text);
  Future<MessageModel> sendVoiceMessage(String companyId, String conversationId, String audioFilePath, int durationMs);
  Future<MessageAttachmentModel> uploadAttachment(
    String companyId,
    String conversationId,
    String messageId,
    String filePath,
    MessageAttachmentKind kind,
  );
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
  Future<List<MessageModel>> getMessages(String companyId, String conversationId, {String? cursor}) async {
    final data = await _client.get<List<dynamic>>(
      ApiConstants.messages(companyId, conversationId),
      queryParameters: cursor != null ? {'cursor': cursor} : null,
    );
    return data.map((e) => MessageModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<MessageModel> sendTextMessage(String companyId, String conversationId, String text) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.sendTextMessage(companyId, conversationId),
      data: {'text': text},
    );
    return MessageModel.fromJson(data);
  }

  @override
  Future<MessageModel> sendVoiceMessage(
    String companyId,
    String conversationId,
    String audioFilePath,
    int durationMs,
  ) async {
    final formData = dio.FormData.fromMap({
      'audio': await dio.MultipartFile.fromFile(
        audioFilePath,
        filename: 'voice-message.m4a',
        contentType: MediaType('audio', 'mp4'), // matches backend's `mimetype.startsWith('audio/')` check
      ),
      'durationMs': durationMs.toString(),
    });
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.sendVoiceMessage(companyId, conversationId),
      data: formData,
    );
    return MessageModel.fromJson(data);
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
