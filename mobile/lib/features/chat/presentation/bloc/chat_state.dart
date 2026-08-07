part of 'chat_bloc.dart';

enum ChatStatus { initial, loading, success, failure }

class ChatState extends Equatable {
  final ChatStatus status;
  final List<MessageEntity> messages;
  final bool isSending;
  final bool isPeerTyping;
  final bool isSocketConnected;
  final bool isRetranslating;
  final MessageEntity? replyTarget;
  final String? errorMessage;
  // BUG FIX (confirmed real, root cause after repeated deep
  // investigation of translation/delivery-status updates not showing
  // live — only after leave+re-enter, i.e. only with a FRESH ChatBloc
  // instance): package:bloc's emit() silently does nothing if the new
  // state is Equatable-equal to the CURRENT state — this is intentional
  // upstream behavior to skip redundant rebuilds. If two genuinely
  // different MessageEntity lists were ever considered equal by
  // Equatable's deep comparison for ANY reason, every subsequent
  // legitimate update would be silently swallowed for the rest of that
  // Bloc's life — exactly matching "works with a new Bloc, stuck with
  // the current one." Rather than hunt for the exact equality quirk,
  // this counter guarantees state != previousState is ALWAYS true after
  // any copyWith(), so Bloc can never mistake a real update for a
  // no-op — closing off this entire class of silent-update-loss bug
  // regardless of its precise cause.
  final int _version;

  const ChatState({
    this.status = ChatStatus.initial,
    this.messages = const [],
    this.isSending = false,
    this.isPeerTyping = false,
    this.isSocketConnected = false,
    this.isRetranslating = false,
    this.replyTarget,
    this.errorMessage,
    int version = 0,
  }) : _version = version;

  ChatState copyWith({
    ChatStatus? status,
    List<MessageEntity>? messages,
    bool? isSending,
    bool? isPeerTyping,
    bool? isSocketConnected,
    bool? isRetranslating,
    MessageEntity? replyTarget,
    bool clearReplyTarget = false,
    String? errorMessage,
  }) {
    return ChatState(
      status: status ?? this.status,
      messages: messages ?? this.messages,
      isSending: isSending ?? this.isSending,
      isPeerTyping: isPeerTyping ?? this.isPeerTyping,
      isSocketConnected: isSocketConnected ?? this.isSocketConnected,
      isRetranslating: isRetranslating ?? this.isRetranslating,
      replyTarget: clearReplyTarget ? null : (replyTarget ?? this.replyTarget),
      errorMessage: errorMessage,
      version: _version + 1,
    );
  }

  @override
  List<Object?> get props =>
      [status, messages, isSending, isPeerTyping, isSocketConnected, isRetranslating, replyTarget, errorMessage, _version];
}
