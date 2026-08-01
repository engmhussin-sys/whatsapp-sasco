import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/fuel_request_entity.dart';

abstract class FuelRequestsRepository {
  Future<Either<Failure, List<FuelRequestEntity>>> getFuelRequests(String companyId);
  Future<Either<Failure, FuelRequestEntity>> getFuelRequest(String companyId, String id);
  Future<Either<Failure, FuelRequestEntity>> createFuelRequest(
    String companyId, {
    required String stationId,
    required String tankId,
    required double currentLevel,
    required double requestedQuantity,
    String? notes,
  });
}
