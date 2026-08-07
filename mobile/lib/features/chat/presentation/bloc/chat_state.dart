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
  // تشخيص مؤقت: يُثبت هل حدث Socket حيّ (ترجمة/حالة) وصل فعلياً لهذه
  // الشاشة أم لا — يُحذَف بعد حسم السبب الجذري لعدم التحديث الحيّ.
  final String? debugLastLiveEvent;

  const ChatState({
    this.status = ChatStatus.initial,
    this.messages = const [],
    this.isSending = false,
    this.isPeerTyping = false,
    this.isSocketConnected = false,
    this.isRetranslating = false,
    this.replyTarget,
    this.errorMessage,
    this.debugLastLiveEvent,
  });

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
    String? debugLastLiveEvent,
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
      debugLastLiveEvent: debugLastLiveEvent ?? this.debugLastLiveEvent,
    );
  }

  @override
  List<Object?> get props =>
      [status, messages, isSending, isPeerTyping, isSocketConnected, isRetranslating, replyTarget, errorMessage, debugLastLiveEvent];
}
