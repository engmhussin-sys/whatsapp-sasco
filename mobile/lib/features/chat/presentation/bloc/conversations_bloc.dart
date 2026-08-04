import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/conversation_entity.dart';
import '../../domain/repositories/chat_repository.dart';
import '../../domain/usecases/get_conversations_usecase.dart';

part 'conversations_event.dart';
part 'conversations_state.dart';

/// BUG FIX (confirmed real user report: "must open the chat to receive
/// the new conversation/message"): this bloc used to fetch the
/// conversation list exactly ONCE, on page load, with zero real-time
/// subscription — a new message in ANY conversation (or a brand new
/// conversation itself) simply never appeared until the person
/// manually left and re-entered the conversations tab. It now listens
/// to the same `message:notification` stream HomeShell already
/// consumes (pushed to the user's own `user:{userId}` room on every
/// connection regardless of which specific conversation rooms are
/// joined — see ChatGateway.onSendMessage) and re-fetches the list on
/// every one, so a new/updated conversation surfaces without the
/// person needing to do anything.
class ConversationsBloc extends Bloc<ConversationsEvent, ConversationsState> {
  final GetConversationsUseCase _getConversations;
  final ChatRepository _chatRepository;
  final String companyId;
  StreamSubscription<Map<String, dynamic>>? _notificationSub;

  ConversationsBloc({
    required GetConversationsUseCase getConversations,
    required ChatRepository chatRepository,
    required this.companyId,
  })  : _getConversations = getConversations,
        _chatRepository = chatRepository,
        super(const ConversationsState()) {
    on<ConversationsRequested>(_onRequested);
    on<ConversationsRealtimeUpdateReceived>(_onRequested);

    _notificationSub = _chatRepository.onNotification.listen((_) {
      add(const ConversationsRealtimeUpdateReceived());
    });
  }

  Future<void> _onRequested(ConversationsEvent event, Emitter<ConversationsState> emit) async {
    emit(state.copyWith(status: ConversationsStatus.loading));
    final result = await _getConversations(GetConversationsParams(companyId));
    result.fold(
      (failure) => emit(state.copyWith(status: ConversationsStatus.failure, errorMessage: failure.message)),
      (conversations) => emit(state.copyWith(status: ConversationsStatus.success, conversations: conversations)),
    );
  }

  @override
  Future<void> close() {
    _notificationSub?.cancel();
    return super.close();
  }
}
