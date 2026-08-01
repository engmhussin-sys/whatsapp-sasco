import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/station_entity.dart';
import '../repositories/stations_repository.dart';

class GetStationsParams extends Equatable {
  final String companyId;
  const GetStationsParams(this.companyId);
  @override
  List<Object?> get props => [companyId];
}

class GetStationsUseCase implements UseCase<List<StationEntity>, GetStationsParams> {
  final StationsRepository repository;
  GetStationsUseCase(this.repository);
  @override
  Future<Either<Failure, List<StationEntity>>> call(GetStationsParams params) => repository.getStations(params.companyId);
}

class GetStationParams extends Equatable {
  final String companyId;
  final String stationId;
  const GetStationParams({required this.companyId, required this.stationId});
  @override
  List<Object?> get props => [companyId, stationId];
}

class GetStationUseCase implements UseCase<StationEntity, GetStationParams> {
  final StationsRepository repository;
  GetStationUseCase(this.repository);
  @override
  Future<Either<Failure, StationEntity>> call(GetStationParams params) =>
      repository.getStation(params.companyId, params.stationId);
}

class UpdateTankLevelParams extends Equatable {
  final String companyId;
  final String tankId;
  final double level;
  const UpdateTankLevelParams({required this.companyId, required this.tankId, required this.level});
  @override
  List<Object?> get props => [companyId, tankId, level];
}

class UpdateTankLevelUseCase implements UseCase<void, UpdateTankLevelParams> {
  final StationsRepository repository;
  UpdateTankLevelUseCase(this.repository);
  @override
  Future<Either<Failure, void>> call(UpdateTankLevelParams params) =>
      repository.updateTankLevel(params.companyId, params.tankId, params.level);
}
