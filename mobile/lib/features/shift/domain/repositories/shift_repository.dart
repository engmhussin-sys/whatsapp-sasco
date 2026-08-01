import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/shift_entity.dart';

abstract class ShiftRepository {
  Future<Either<Failure, List<ShiftEntity>>> getShifts(String companyId);
  Future<Either<Failure, List<ShiftLogEntity>>> getMyShiftLogs(String companyId);
  Future<Either<Failure, ShiftLogEntity>> openShift(String companyId, String shiftId, {String? stationId});
  Future<Either<Failure, ShiftLogEntity>> closeShift(String companyId, String shiftLogId);
}
