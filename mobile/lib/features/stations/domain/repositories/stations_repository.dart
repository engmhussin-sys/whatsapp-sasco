import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/station_entity.dart';

abstract class StationsRepository {
  Future<Either<Failure, List<StationEntity>>> getStations(String companyId);
  Future<Either<Failure, StationEntity>> getStation(String companyId, String id);
  Future<Either<Failure, void>> updateTankLevel(String companyId, String tankId, double level);
}
