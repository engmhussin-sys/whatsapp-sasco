import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/api_constants.dart';
import '../storage/secure_storage_service.dart';
import 'token_refresh_service.dart';

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
  final TokenRefreshService _tokenRefresh;

  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _notificationController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final _readController = StreamController<Map<String, dynamic>>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  bool _didRetryWithFreshToken = false;
  Timer? _watchdog;

  WebSocketClient(this._secureStorage, this._tokenRefresh);

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
      ..onConnect((_) {
        _didRetryWithFreshToken = false; // a successful connect resets the retry guard
        _connectionController.add(true);
      })
      ..onDisconnect((_) => _connectionController.add(false))
      // BUG FIX (confirmed via a real production log: "Rejected socket
      // connection: invalid signature"): if the app is reopened after
      // the access token has expired, the very FIRST connect attempt
      // used to just fail silently forever — HTTP requests self-heal
      // via AuthInterceptor's 401-retry, but the socket had no
      // equivalent. On a connect error, refresh once and reconnect;
      // `_didRetryWithFreshToken` stops this from looping if the
      // refresh token itself is also invalid (e.g. truly logged out).
      ..onConnectError((error) async {
        if (_didRetryWithFreshToken) return;
        _didRetryWithFreshToken = true;
        final refreshed = await _tokenRefresh.refresh();
        if (refreshed) await connect();
      })
      ..on('message:new', (data) => _messageController.add(Map<String, dynamic>.from(data as Map)))
      ..on('message:notification', (data) => _notificationController.add(Map<String, dynamic>.from(data as Map)))
      ..on('typing', (data) => _typingController.add(Map<String, dynamic>.from(data as Map)))
      ..on('message:read', (data) => _readController.add(Map<String, dynamic>.from(data as Map)));

    _socket!.connect();

    // BUG FIX (confirmed via real production logs): after a JWT-expiry
    // rejection, the socket sometimes never reconnects at all — not
    // even once — until the app is fully restarted, even though HTTP
    // requests keep self-healing fine via AuthInterceptor the entire
    // time. Whether onConnectError above isn't firing the way it does
    // in the JS client, or the library's own internal auto-reconnect is
    // giving up silently, this doesn't depend on pinpointing which: a
    // periodic watchdog independently checks "am I actually connected?"
    // and forces a fresh-token reconnect if not — a second, independent
    // safety net on top of onConnectError, not a replacement for it.
    _watchdog?.cancel();
    _watchdog = Timer.periodic(const Duration(seconds: 20), (_) async {
      if (_socket != null && !isConnected) {
        await connect();
      }
    });
  }

  void disconnect() {
    _watchdog?.cancel();
    _watchdog = null;
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
