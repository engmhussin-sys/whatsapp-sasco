import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/fuel_request_entity.dart';
import '../repositories/fuel_requests_repository.dart';

class GetFuelRequestsParams extends Equatable {
  final String companyId;
  const GetFuelRequestsParams(this.companyId);
  @override
  List<Object?> get props => [companyId];
}

class GetFuelRequestsUseCase implements UseCase<List<FuelRequestEntity>, GetFuelRequestsParams> {
  final FuelRequestsRepository repository;
  GetFuelRequestsUseCase(this.repository);
  @override
  Future<Either<Failure, List<FuelRequestEntity>>> call(GetFuelRequestsParams params) =>
      repository.getFuelRequests(params.companyId);
}

class GetFuelRequestParams extends Equatable {
  final String companyId;
  final String id;
  const GetFuelRequestParams({required this.companyId, required this.id});
  @override
  List<Object?> get props => [companyId, id];
}

class GetFuelRequestUseCase implements UseCase<FuelRequestEntity, GetFuelRequestParams> {
  final FuelRequestsRepository repository;
  GetFuelRequestUseCase(this.repository);
  @override
  Future<Either<Failure, FuelRequestEntity>> call(GetFuelRequestParams params) =>
      repository.getFuelRequest(params.companyId, params.id);
}

class CreateFuelRequestParams extends Equatable {
  final String companyId;
  final String stationId;
  final String tankId;
  final double currentLevel;
  final double requestedQuantity;
  final String? notes;
  const CreateFuelRequestParams({
    required this.companyId,
    required this.stationId,
    required this.tankId,
    required this.currentLevel,
    required this.requestedQuantity,
    this.notes,
  });
  @override
  List<Object?> get props => [companyId, stationId, tankId, currentLevel, requestedQuantity, notes];
}

class CreateFuelRequestUseCase implements UseCase<FuelRequestEntity, CreateFuelRequestParams> {
  final FuelRequestsRepository repository;
  CreateFuelRequestUseCase(this.repository);
  @override
  Future<Either<Failure, FuelRequestEntity>> call(CreateFuelRequestParams params) => repository.createFuelRequest(
        params.companyId,
        stationId: params.stationId,
        tankId: params.tankId,
        currentLevel: params.currentLevel,
        requestedQuantity: params.requestedQuantity,
        notes: params.notes,
      );
}
