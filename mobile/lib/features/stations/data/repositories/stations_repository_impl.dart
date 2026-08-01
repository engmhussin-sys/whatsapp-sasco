import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/station_entity.dart';
import '../../domain/repositories/stations_repository.dart';
import '../datasources/stations_remote_data_source.dart';

class StationsRepositoryImpl implements StationsRepository {
  final StationsRemoteDataSource _remote;
  StationsRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<StationEntity>>> getStations(String companyId) async {
    try {
      return Right(await _remote.getStations(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, StationEntity>> getStation(String companyId, String id) async {
    try {
      return Right(await _remote.getStation(companyId, id));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, void>> updateTankLevel(String companyId, String tankId, double level) async {
    try {
      await _remote.updateTankLevel(companyId, tankId, level);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }
}
