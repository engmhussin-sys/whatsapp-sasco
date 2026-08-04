import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/join_request_entity.dart';
import '../../domain/repositories/join_request_repository.dart';

enum PendingRequestsStatus { initial, loading, success, failure }

class PendingRequestsState extends Equatable {
  final PendingRequestsStatus status;
  final List<JoinRequestEntity> requests;
  final String? errorMessage;
  final String? decidingRequestId;

  const PendingRequestsState({
    this.status = PendingRequestsStatus.initial,
    this.requests = const [],
    this.errorMessage,
    this.decidingRequestId,
  });

  PendingRequestsState copyWith({
    PendingRequestsStatus? status,
    List<JoinRequestEntity>? requests,
    String? errorMessage,
    String? decidingRequestId,
    bool clearDecidingRequestId = false,
  }) =>
      PendingRequestsState(
        status: status ?? this.status,
        requests: requests ?? this.requests,
        errorMessage: errorMessage,
        decidingRequestId: clearDecidingRequestId ? null : (decidingRequestId ?? this.decidingRequestId),
      );

  @override
  List<Object?> get props => [status, requests, errorMessage, decidingRequestId];
}

class PendingRequestsCubit extends Cubit<PendingRequestsState> {
  final JoinRequestRepository _repository;
  final String companyId;
  final String conversationId;

  PendingRequestsCubit({required JoinRequestRepository repository, required this.companyId, required this.conversationId})
      : _repository = repository,
        super(const PendingRequestsState());

  Future<void> load() async {
    emit(state.copyWith(status: PendingRequestsStatus.loading));
    final result = await _repository.getPendingRequests(companyId, conversationId);
    result.fold(
      (failure) => emit(state.copyWith(status: PendingRequestsStatus.failure, errorMessage: failure.message)),
      (requests) => emit(state.copyWith(status: PendingRequestsStatus.success, requests: requests)),
    );
  }

  Future<void> decide(String requestId, {required bool approve}) async {
    emit(state.copyWith(decidingRequestId: requestId));
    final result = await _repository.decideRequest(companyId, requestId, approve: approve);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message, clearDecidingRequestId: true)),
      (_) {
        // Remove it from the list locally — it's been decided, no
        // longer "pending" regardless of which way it went.
        final updated = state.requests.where((r) => r.id != requestId).toList();
        emit(state.copyWith(requests: updated, clearDecidingRequestId: true));
      },
    );
  }
}
