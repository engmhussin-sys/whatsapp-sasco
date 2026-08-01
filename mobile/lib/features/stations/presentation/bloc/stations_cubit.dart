import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/station_entity.dart';
import '../../domain/usecases/stations_usecases.dart';

enum StationsStatus { initial, loading, success, failure }

class StationsState extends Equatable {
  final StationsStatus status;
  final List<StationEntity> stations;
  final String? errorMessage;

  const StationsState({this.status = StationsStatus.initial, this.stations = const [], this.errorMessage});

  StationsState copyWith({StationsStatus? status, List<StationEntity>? stations, String? errorMessage}) => StationsState(
        status: status ?? this.status,
        stations: stations ?? this.stations,
        errorMessage: errorMessage,
      );

  @override
  List<Object?> get props => [status, stations, errorMessage];
}

class StationsCubit extends Cubit<StationsState> {
  final GetStationsUseCase _getStations;
  final UpdateTankLevelUseCase _updateTankLevel;
  final String companyId;

  StationsCubit({required GetStationsUseCase getStations, required UpdateTankLevelUseCase updateTankLevel, required this.companyId})
      : _getStations = getStations,
        _updateTankLevel = updateTankLevel,
        super(const StationsState());

  Future<void> load() async {
    emit(state.copyWith(status: StationsStatus.loading));
    final result = await _getStations(GetStationsParams(companyId));
    result.fold(
      (failure) => emit(state.copyWith(status: StationsStatus.failure, errorMessage: failure.message)),
      (stations) => emit(state.copyWith(status: StationsStatus.success, stations: stations)),
    );
  }

  Future<void> updateTankLevel(String tankId, double level) async {
    final result = await _updateTankLevel(UpdateTankLevelParams(companyId: companyId, tankId: tankId, level: level));
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: failure.message)),
      (_) => load(),
    );
  }
}
