import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/conversation_entity.dart';
import '../../domain/usecases/get_conversations_usecase.dart';

part 'conversations_event.dart';
part 'conversations_state.dart';

class ConversationsBloc extends Bloc<ConversationsEvent, ConversationsState> {
  final GetConversationsUseCase _getConversations;
  final String companyId;

  ConversationsBloc({required GetConversationsUseCase getConversations, required this.companyId})
      : _getConversations = getConversations,
        super(const ConversationsState()) {
    on<ConversationsRequested>(_onRequested);
  }

  Future<void> _onRequested(ConversationsRequested event, Emitter<ConversationsState> emit) async {
    emit(state.copyWith(status: ConversationsStatus.loading));
    final result = await _getConversations(GetConversationsParams(companyId));
    result.fold(
      (failure) => emit(state.copyWith(status: ConversationsStatus.failure, errorMessage: failure.message)),
      (conversations) => emit(state.copyWith(status: ConversationsStatus.success, conversations: conversations)),
    );
  }
}
