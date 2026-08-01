import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/fuel_request_entity.dart';
import '../../domain/usecases/fuel_requests_usecases.dart';

enum FuelRequestsStatus { initial, loading, success, failure }

class FuelRequestsState extends Equatable {
  final FuelRequestsStatus status;
  final List<FuelRequestEntity> requests;
  final bool isCreating;
  final String? errorMessage;

  const FuelRequestsState({
    this.status = FuelRequestsStatus.initial,
    this.requests = const [],
    this.isCreating = false,
    this.errorMessage,
  });

  FuelRequestsState copyWith({
    FuelRequestsStatus? status,
    List<FuelRequestEntity>? requests,
    bool? isCreating,
    String? errorMessage,
  }) {
    return FuelRequestsState(
      status: status ?? this.status,
      requests: requests ?? this.requests,
      isCreating: isCreating ?? this.isCreating,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, requests, isCreating, errorMessage];
}

class FuelRequestsCubit extends Cubit<FuelRequestsState> {
  final GetFuelRequestsUseCase _getFuelRequests;
  final CreateFuelRequestUseCase _createFuelRequest;
  final String companyId;

  FuelRequestsCubit({
    required GetFuelRequestsUseCase getFuelRequests,
    required CreateFuelRequestUseCase createFuelRequest,
    required this.companyId,
  })  : _getFuelRequests = getFuelRequests,
        _createFuelRequest = createFuelRequest,
        super(const FuelRequestsState());

  Future<void> load() async {
    emit(state.copyWith(status: FuelRequestsStatus.loading));
    final result = await _getFuelRequests(GetFuelRequestsParams(companyId));
    result.fold(
      (failure) => emit(state.copyWith(status: FuelRequestsStatus.failure, errorMessage: failure.message)),
      (requests) => emit(state.copyWith(status: FuelRequestsStatus.success, requests: requests)),
    );
  }

  Future<bool> create({
    required String stationId,
    required String tankId,
    required double currentLevel,
    required double requestedQuantity,
    String? notes,
  }) async {
    emit(state.copyWith(isCreating: true));
    final result = await _createFuelRequest(CreateFuelRequestParams(
      companyId: companyId,
      stationId: stationId,
      tankId: tankId,
      currentLevel: currentLevel,
      requestedQuantity: requestedQuantity,
      notes: notes,
    ));
    return result.fold(
      (failure) {
        emit(state.copyWith(isCreating: false, errorMessage: failure.message));
        return false;
      },
      (_) {
        emit(state.copyWith(isCreating: false));
        load();
        return true;
      },
    );
  }
}
