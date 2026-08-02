import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../domain/usecases/get_messages_usecase.dart';
import '../../domain/usecases/mark_read_usecase.dart';
import '../../domain/usecases/send_text_message_usecase.dart';
import '../../domain/usecases/send_voice_message_usecase.dart';

part 'chat_event.dart';
part 'chat_state.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  final String companyId;
  final String conversationId;
  final ChatRepository _repository;
  final GetMessagesUseCase _getMessages;
  final SendTextMessageUseCase _sendTextMessage;
  final SendVoiceMessageUseCase _sendVoiceMessage;
  final MarkReadUseCase _markRead;

  StreamSubscription<MessageEntity>? _messageSub;
  StreamSubscription<Map<String, dynamic>>? _typingSub;

  ChatBloc({
    required this.companyId,
    required this.conversationId,
    required ChatRepository repository,
    required GetMessagesUseCase getMessages,
    required SendTextMessageUseCase sendTextMessage,
    required SendVoiceMessageUseCase sendVoiceMessage,
    required MarkReadUseCase markRead,
  })  : _repository = repository,
        _getMessages = getMessages,
        _sendTextMessage = sendTextMessage,
        _sendVoiceMessage = sendVoiceMessage,
        _markRead = markRead,
        super(const ChatState()) {
    on<ChatStarted>(_onStarted);
    on<ChatEnded>(_onEnded);
    on<ChatTextMessageSent>(_onTextMessageSent);
    on<ChatVoiceMessageSent>(_onVoiceMessageSent);
    on<ChatMarkReadRequested>(_onMarkReadRequested);
    on<ChatTypingIndicatorChanged>(_onTypingIndicatorChanged);
    on<ChatMessageReceived>(_onMessageReceived);
    on<ChatPeerTypingReceived>(_onPeerTypingReceived);
  }

  Future<void> _onStarted(ChatStarted event, Emitter<ChatState> emit) async {
    emit(state.copyWith(status: ChatStatus.loading));

    // Join the Socket.io room for this conversation FIRST so no message
    // sent by the peer in the gap between history-fetch and subscription
    // is missed.
    _repository.joinConversation(conversationId);

    _messageSub = _repository.onMessageReceived
        .where((m) => m.conversationId == conversationId)
        .listen((m) => add(ChatMessageReceived(m)));

    _typingSub = _repository.onTypingChanged.listen((data) {
      add(ChatPeerTypingReceived(data['isTyping'] as bool? ?? false));
    });

    final result = await _getMessages(GetMessagesParams(companyId: companyId, conversationId: conversationId));
    result.fold(
      (failure) => emit(state.copyWith(status: ChatStatus.failure, errorMessage: failure.message)),
      (messages) => emit(state.copyWith(
        status: ChatStatus.success,
        // API returns newest-first; render oldest-first for a standard chat UI.
        messages: messages.reversed.toList(),
      )),
    );

    add(const ChatMarkReadRequested());
  }

  Future<void> _onEnded(ChatEnded event, Emitter<ChatState> emit) async {
    _repository.leaveConversation(conversationId);
    await _messageSub?.cancel();
    await _typingSub?.cancel();
  }

  Future<void> _onTextMessageSent(ChatTextMessageSent event, Emitter<ChatState> emit) async {
    if (event.text.trim().isEmpty) return;
    emit(state.copyWith(isSending: true));
    final result = await _sendTextMessage(
      SendTextMessageParams(companyId: companyId, conversationId: conversationId, text: event.text.trim()),
    );
    result.fold(
      (failure) => emit(state.copyWith(isSending: false, errorMessage: failure.message)),
      (message) {
        // The server also echoes this back over the socket to everyone in
        // the room (including us) — de-dupe by id in _onMessageReceived so
        // it isn't appended twice.
        emit(state.copyWith(isSending: false, messages: [...state.messages, message]));
      },
    );
  }

  Future<void> _onVoiceMessageSent(ChatVoiceMessageSent event, Emitter<ChatState> emit) async {
    emit(state.copyWith(isSending: true));
    final result = await _sendVoiceMessage(
      SendVoiceMessageParams(
        companyId: companyId,
        conversationId: conversationId,
        audioFilePath: event.audioFilePath,
        durationMs: event.durationMs,
      ),
    );
    result.fold(
      (failure) => emit(state.copyWith(isSending: false, errorMessage: failure.message)),
      (message) => emit(state.copyWith(isSending: false, messages: [...state.messages, message])),
    );
  }

  Future<void> _onMarkReadRequested(ChatMarkReadRequested event, Emitter<ChatState> emit) async {
    await _markRead(MarkReadParams(companyId: companyId, conversationId: conversationId));
  }

  void _onTypingIndicatorChanged(ChatTypingIndicatorChanged event, Emitter<ChatState> emit) {
    _repository.sendTypingIndicator(conversationId, event.isTyping);
  }

  void _onMessageReceived(ChatMessageReceived event, Emitter<ChatState> emit) {
    final alreadyPresent = state.messages.any((m) => m.id == event.message.id);
    if (alreadyPresent) return;
    emit(state.copyWith(messages: [...state.messages, event.message]));
    add(const ChatMarkReadRequested());
  }

  void _onPeerTypingReceived(ChatPeerTypingReceived event, Emitter<ChatState> emit) {
    emit(state.copyWith(isPeerTyping: event.isTyping));
  }

  @override
  Future<void> close() async {
    _messageSub?.cancel();
    _typingSub?.cancel();
    return super.close();
  }
}
