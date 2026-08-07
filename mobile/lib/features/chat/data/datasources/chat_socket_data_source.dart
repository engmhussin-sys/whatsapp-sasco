import '../../../../core/network/websocket_client.dart';
import '../models/message_model.dart';

/// Thin adapter over the generic WebSocketClient, translating raw socket
/// payloads into typed MessageModel streams for the repository — keeps
/// JSON-shape knowledge in the data layer, not in core/network.
class ChatSocketDataSource {
  final WebSocketClient _client;
  ChatSocketDataSource(this._client);

  Future<void> connect() => _client.connect();
  void disconnect() => _client.disconnect();
  bool get isConnected => _client.isConnected;

  void joinConversation(String conversationId) => _client.joinConversation(conversationId);
  void leaveConversation(String conversationId) => _client.leaveConversation(conversationId);
  void sendTyping(String conversationId, bool isTyping) => _client.sendTyping(conversationId, isTyping);
  void markRead(String conversationId, {String? upToMessageId}) =>
      _client.markRead(conversationId, upToMessageId: upToMessageId);

  Stream<MessageModel> get onNewMessage => _client.onNewMessage.map((json) => MessageModel.fromJson(json));
  Stream<MessageModel> get onMessageTranslated => _client.onMessageTranslated.map((json) => MessageModel.fromJson(json));
  Stream<Map<String, dynamic>> get onNotification => _client.onNotification;
  Stream<Map<String, dynamic>> get onTyping => _client.onTyping;
  Stream<Map<String, dynamic>> get onMessageRead => _client.onMessageRead;
  Stream<Map<String, dynamic>> get onMessageStatusChanged => _client.onMessageStatusChanged;
  Stream<bool> get onConnectionChanged => _client.onConnectionChanged;
}
