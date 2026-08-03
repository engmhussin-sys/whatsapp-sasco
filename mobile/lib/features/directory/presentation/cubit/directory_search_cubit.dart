import 'dart:async';
import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/directory_user_entity.dart';
import '../../domain/repositories/directory_repository.dart';

enum DirectorySearchStatus { initial, loading, success, failure }

class DirectorySearchState extends Equatable {
  final DirectorySearchStatus status;
  final List<DirectoryUserEntity> results;
  final String? errorMessage;

  const DirectorySearchState({this.status = DirectorySearchStatus.initial, this.results = const [], this.errorMessage});

  DirectorySearchState copyWith({DirectorySearchStatus? status, List<DirectoryUserEntity>? results, String? errorMessage}) =>
      DirectorySearchState(
        status: status ?? this.status,
        results: results ?? this.results,
        errorMessage: errorMessage,
      );

  @override
  List<Object?> get props => [status, results, errorMessage];
}

/// Debounces keystrokes (300ms) before actually calling the server — a
/// naive per-keystroke search would fire a request on every letter typed,
/// wasting calls and frequently showing stale results out of order.
class DirectorySearchCubit extends Cubit<DirectorySearchState> {
  final DirectoryRepository _repository;
  final String companyId;
  Timer? _debounce;

  DirectorySearchCubit({required DirectoryRepository repository, required this.companyId})
      : _repository = repository,
        super(const DirectorySearchState());

  void search(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _runSearch(query));
  }

  /// Loads the initial (unfiltered) list immediately — used on page open,
  /// bypassing the debounce so the list isn't empty while waiting.
  void loadInitial() => _runSearch('');

  Future<void> _runSearch(String query) async {
    emit(state.copyWith(status: DirectorySearchStatus.loading));
    final result = await _repository.searchUsers(companyId, search: query.isEmpty ? null : query);
    result.fold(
      (failure) => emit(state.copyWith(status: DirectorySearchStatus.failure, errorMessage: failure.message)),
      (users) => emit(state.copyWith(status: DirectorySearchStatus.success, results: users)),
    );
  }

  @override
  Future<void> close() {
    _debounce?.cancel();
    return super.close();
  }
}
