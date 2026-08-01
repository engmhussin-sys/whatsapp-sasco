import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';

/// Real-time client for backend's ChatGateway (see
/// backend/src/modules/websocket/chat.gateway.ts). Connects to the
/// `/chat` namespace with the JWT access token in the handshake auth
/// payload — exactly what ChatGateway.handleConnection() expects.
///
/// Event names below are a 1:1 mirror of the backend's @SubscribeMessage
/// handlers and server-emitted events — this is NOT a generic pub/sub
/// wrapper, it is deliberately coupled to the real gateway's contract so
/// there is no drift between what the app sends and what the server
/// understands.
class WebSocketClient {
  io.Socket? _socket;
  final SecureStorageService _secureStorage;

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _notificationController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final _readController = StreamController<Map<String, dynamic>>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  WebSocketClient(this._secureStorage);

  Stream<Map<String, dynamic>> get onNewMessage => _messageController.stream;
  Stream<Map<String, dynamic>> get onNotification => _notificationController.stream;
  Stream<Map<String, dynamic>> get onTyping => _typingController.stream;
  Stream<Map<String, dynamic>> get onMessageRead => _readController.stream;
  Stream<bool> get onConnectionChanged => _connectionController.stream;

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    final token = await _secureStorage.getAccessToken();
    if (token == null) return;

    _socket?.dispose();

    _socket = io.io(
      '${ApiConstants.wsUrl}/chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );

    _socket!
      ..onConnect((_) => _connectionController.add(true))
      ..onDisconnect((_) => _connectionController.add(false))
      ..on('message:new', (data) => _messageController.add(Map<String, dynamic>.from(data as Map)))
      ..on('message:notification', (data) => _notificationController.add(Map<String, dynamic>.from(data as Map)))
      ..on('typing', (data) => _typingController.add(Map<String, dynamic>.from(data as Map)))
      ..on('message:read', (data) => _readController.add(Map<String, dynamic>.from(data as Map)));

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  /// Joins the Socket.io room for a conversation — mirrors
  /// ChatGateway.onJoinConversation(). Must be called before messages
  /// for that conversation will be received in real time.
  void joinConversation(String conversationId) {
    _socket?.emit('joinConversation', {'conversationId': conversationId});
  }

  void leaveConversation(String conversationId) {
    _socket?.emit('leaveConversation', {'conversationId': conversationId});
  }

  /// Sends a text message over the socket (ChatGateway.onSendMessage).
  /// Voice messages still go through the REST upload endpoint (multipart
  /// isn't practical over a socket event) — see ChatRemoteDataSource.
  void sendMessage(String conversationId, String text) {
    _socket?.emit('sendMessage', {'conversationId': conversationId, 'text': text});
  }

  void sendTyping(String conversationId, bool isTyping) {
    _socket?.emit('typing', {'conversationId': conversationId, 'isTyping': isTyping});
  }

  void markRead(String conversationId, {String? upToMessageId}) {
    _socket?.emit('markRead', {'conversationId': conversationId, 'upToMessageId': upToMessageId});
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _notificationController.close();
    _typingController.close();
    _readController.close();
    _connectionController.close();
  }
}
