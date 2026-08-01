import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/shift_entity.dart';
import '../../domain/repositories/shift_repository.dart';
import '../datasources/shift_remote_data_source.dart';

class ShiftRepositoryImpl implements ShiftRepository {
  final ShiftRemoteDataSource _remote;
  ShiftRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<ShiftEntity>>> getShifts(String companyId) async {
    try {
      return Right(await _remote.getShifts(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, List<ShiftLogEntity>>> getMyShiftLogs(String companyId) async {
    try {
      return Right(await _remote.getMyShiftLogs(companyId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, ShiftLogEntity>> openShift(String companyId, String shiftId, {String? stationId}) async {
    try {
      return Right(await _remote.openShift(companyId, shiftId, stationId: stationId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, ShiftLogEntity>> closeShift(String companyId, String shiftLogId) async {
    try {
      return Right(await _remote.closeShift(companyId, shiftLogId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }
}
