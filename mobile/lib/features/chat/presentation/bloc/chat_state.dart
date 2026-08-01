part of 'chat_bloc.dart';

enum ChatStatus { initial, loading, success, failure }

class ChatState extends Equatable {
  final ChatStatus status;
  final List<MessageEntity> messages;
  final bool isSending;
  final bool isPeerTyping;
  final bool isSocketConnected;
  final String? errorMessage;

  const ChatState({
    this.status = ChatStatus.initial,
    this.messages = const [],
    this.isSending = false,
    this.isPeerTyping = false,
    this.isSocketConnected = false,
    this.errorMessage,
  });

  ChatState copyWith({
    ChatStatus? status,
    List<MessageEntity>? messages,
    bool? isSending,
    bool? isPeerTyping,
    bool? isSocketConnected,
    String? errorMessage,
  }) {
    return ChatState(
      status: status ?? this.status,
      messages: messages ?? this.messages,
      isSending: isSending ?? this.isSending,
      isPeerTyping: isPeerTyping ?? this.isPeerTyping,
      isSocketConnected: isSocketConnected ?? this.isSocketConnected,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, messages, isSending, isPeerTyping, isSocketConnected, errorMessage];
}
