import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/fuel_request_entity.dart';
import '../../domain/repositories/fuel_requests_repository.dart';
import '../datasources/fuel_requests_remote_data_source.dart';

class FuelRequestsRepositoryImpl implements FuelRequestsRepository {
  final FuelRequestsRemoteDataSource _remote;
  FuelRequestsRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<FuelRequestEntity>>> getFuelRequests(String companyId) async {
    try {
      return Right(await _remote.getFuelRequests(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, FuelRequestEntity>> getFuelRequest(String companyId, String id) async {
    try {
      return Right(await _remote.getFuelRequest(companyId, id));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, FuelRequestEntity>> createFuelRequest(
    String companyId, {
    required String stationId,
    required String tankId,
    required double currentLevel,
    required double requestedQuantity,
    String? notes,
  }) async {
    try {
      return Right(await _remote.create(
        companyId,
        stationId: stationId,
        tankId: tankId,
        currentLevel: currentLevel,
        requestedQuantity: requestedQuantity,
        notes: notes,
      ));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }
}
