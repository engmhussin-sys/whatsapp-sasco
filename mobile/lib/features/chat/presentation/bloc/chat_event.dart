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
  final String? replyToId;
  const ChatTextMessageSent(this.text, {this.replyToId});
  @override
  List<Object?> get props => [text, replyToId];
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

/// Fired whenever the underlying socket reconnects while this chat is
/// open — see the "BUG FIX" comment on _onStarted in chat_bloc.dart for
/// exactly why this is needed (room membership doesn't survive a
/// reconnect on its own).
class ChatReconnectedRefreshRequested extends ChatEvent {
  const ChatReconnectedRefreshRequested();
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

class ChatMessageTranslated extends ChatEvent {
  final MessageEntity message;
  const ChatMessageTranslated(this.message);
  @override
  List<Object?> get props => [message];
}

/// REVIEW_ROUND7.md §4: Internal — dispatched when a message's delivery
/// status changes (SENT/DELIVERED/READ) via message:status_changed.
class ChatMessageStatusChanged extends ChatEvent {
  final String messageId;
  final MessageDeliveryStatus status;
  const ChatMessageStatusChanged(this.messageId, this.status);
  @override
  List<Object?> get props => [messageId, status];
}

/// تشخيص مؤقت — يُحذَف بعد حسم سبب عدم التحديث الحيّ.
class ChatDebugLiveEventReceived extends ChatEvent {
  final String description;
  const ChatDebugLiveEventReceived(this.description);
  @override
  List<Object?> get props => [description];
}

/// Internal — dispatched when the peer's typing state changes over the socket.
class ChatPeerTypingReceived extends ChatEvent {
  final bool isTyping;
  const ChatPeerTypingReceived(this.isTyping);
  @override
  List<Object?> get props => [isTyping];
}

/// T5 "إعادة ترجمة" button — backfills translations for [targetLanguage]
/// across older messages in this conversation, then reloads.
class ChatRetranslateRequested extends ChatEvent {
  final String targetLanguage;
  const ChatRetranslateRequested(this.targetLanguage);
  @override
  List<Object?> get props => [targetLanguage];
}

/// A1 (real-user review, 2026-08-05): explicit retry when voice
/// transcription failed — no client-side state change here, the actual
/// update arrives via the SAME message:translated socket event a
/// successful transcription would use.
class ChatRetryVoiceTranscriptionRequested extends ChatEvent {
  final String messageId;
  const ChatRetryVoiceTranscriptionRequested(this.messageId);
  @override
  List<Object?> get props => [messageId];
}

/// Group 1 (WhatsApp parity) — send an image/document. [caption] is
/// optional; a default label is used when omitted (see
/// ChatRepositoryImpl._defaultCaptionFor).
class ChatSendAttachmentRequested extends ChatEvent {
  final String filePath;
  final MessageAttachmentKind kind;
  final String? caption;
  const ChatSendAttachmentRequested({required this.filePath, required this.kind, this.caption});
  @override
  List<Object?> get props => [filePath, kind, caption];
}

/// Group 2 (WhatsApp parity) — "Delete for everyone" (server call, sender-only, enforced backend-side).
class ChatDeleteMessageRequested extends ChatEvent {
  final String messageId;
  const ChatDeleteMessageRequested(this.messageId);
  @override
  List<Object?> get props => [messageId];
}

/// "Delete for me" — purely local list filter, no server call at all.
class ChatLocalDeleteRequested extends ChatEvent {
  final String messageId;
  const ChatLocalDeleteRequested(this.messageId);
  @override
  List<Object?> get props => [messageId];
}

/// Sets/clears which message the composer is currently replying to
/// (shows the quoted preview above the text field).
class ChatReplyTargetChanged extends ChatEvent {
  final MessageEntity? target; // null clears it
  const ChatReplyTargetChanged(this.target);
  @override
  List<Object?> get props => [target];
}

/// Group 3 (WhatsApp parity) — toggle a reaction. [myUserId] is passed
/// in (rather than read from AuthBloc here) so the optimistic local
/// update knows whose entry in the reactions map to touch.
class ChatReactToMessageRequested extends ChatEvent {
  final String messageId;
  final String emoji;
  final String myUserId;
  const ChatReactToMessageRequested({required this.messageId, required this.emoji, required this.myUserId});
  @override
  List<Object?> get props => [messageId, emoji, myUserId];
}

class ChatEditMessageRequested extends ChatEvent {
  final String messageId;
  final String newText;
  const ChatEditMessageRequested({required this.messageId, required this.newText});
  @override
  List<Object?> get props => [messageId, newText];
}
