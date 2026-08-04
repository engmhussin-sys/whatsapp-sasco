import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/joinable_group_entity.dart';
import '../../domain/repositories/join_request_repository.dart';

enum JoinableGroupsStatus { initial, loading, success, failure }

class JoinableGroupsState extends Equatable {
  final JoinableGroupsStatus status;
  final List<JoinableGroupEntity> groups;
  final String? errorMessage;
  /// Tracks which specific group a request is currently in-flight for,
  /// so only that group's button shows a spinner rather than the whole
  /// list appearing to freeze.
  final String? requestingGroupId;

  const JoinableGroupsState({
    this.status = JoinableGroupsStatus.initial,
    this.groups = const [],
    this.errorMessage,
    this.requestingGroupId,
  });

  JoinableGroupsState copyWith({
    JoinableGroupsStatus? status,
    List<JoinableGroupEntity>? groups,
    String? errorMessage,
    String? requestingGroupId,
    bool clearRequestingGroupId = false,
  }) =>
      JoinableGroupsState(
        status: status ?? this.status,
        groups: groups ?? this.groups,
        errorMessage: errorMessage,
        requestingGroupId: clearRequestingGroupId ? null : (requestingGroupId ?? this.requestingGroupId),
      );

  @override
  List<Object?> get props => [status, groups, errorMessage, requestingGroupId];
}

class JoinableGroupsCubit extends Cubit<JoinableGroupsState> {
  final JoinRequestRepository _repository;
  final String companyId;

  JoinableGroupsCubit({required JoinRequestRepository repository, required this.companyId})
      : _repository = repository,
        super(const JoinableGroupsState());

  Future<void> load() async {
    emit(state.copyWith(status: JoinableGroupsStatus.loading));
    final result = await _repository.getJoinableGroups(companyId);
    result.fold(
      (failure) => emit(state.copyWith(status: JoinableGroupsStatus.failure, errorMessage: failure.message)),
      (groups) => emit(state.copyWith(status: JoinableGroupsStatus.success, groups: groups)),
    );
  }

  Future<void> requestToJoin(String conversationId) async {
    emit(state.copyWith(requestingGroupId: conversationId));
    final result = await _repository.requestToJoin(companyId, conversationId);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message, clearRequestingGroupId: true)),
      (_) {
        // Optimistically mark this group as PENDING locally rather than
        // re-fetching the whole list — the request clearly succeeded,
        // no need for a round-trip just to learn what we already know.
        final updated = state.groups
            .map((g) => g.id == conversationId
                ? JoinableGroupEntity(id: g.id, title: g.title, memberCount: g.memberCount, myRequestStatus: 'PENDING')
                : g)
            .toList();
        emit(state.copyWith(groups: updated, clearRequestingGroupId: true));
      },
    );
  }
}
