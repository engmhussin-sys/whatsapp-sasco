part of 'chat_bloc.dart';

abstract class ChatEvent extends Equatable {
  const ChatEvent();
  @override
  List<Object?> get props => [];
}

class ChatStarted extends ChatEvent {
  const ChatStarted();
}

class ChatEnded extends ChatEvent {
  const ChatEnded();
}

class ChatTextMessageSent extends ChatEvent {
  final String text;
  const ChatTextMessageSent(this.text);
  @override
  List<Object?> get props => [text];
}

class ChatVoiceMessageSent extends ChatEvent {
  final String audioFilePath;
  final int durationMs;
  const ChatVoiceMessageSent({required this.audioFilePath, required this.durationMs});
  @override
  List<Object?> get props => [audioFilePath, durationMs];
}

class ChatMarkReadRequested extends ChatEvent {
  const ChatMarkReadRequested();
}

class ChatTypingIndicatorChanged extends ChatEvent {
  final bool isTyping;
  const ChatTypingIndicatorChanged(this.isTyping);
  @override
  List<Object?> get props => [isTyping];
}

/// Internal — dispatched when a message arrives over the WebSocket.
class ChatMessageReceived extends ChatEvent {
  final MessageEntity message;
  const ChatMessageReceived(this.message);
  @override
  List<Object?> get props => [message];
}

/// Internal — dispatched when the peer's typing state changes over the socket.
class ChatPeerTypingReceived extends ChatEvent {
  final bool isTyping;
  const ChatPeerTypingReceived(this.isTyping);
  @override
  List<Object?> get props => [isTyping];
}
