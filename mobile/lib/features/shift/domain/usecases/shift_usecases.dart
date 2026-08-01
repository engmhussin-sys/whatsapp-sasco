import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/shift_entity.dart';
import '../repositories/shift_repository.dart';

class CompanyParams extends Equatable {
  final String companyId;
  const CompanyParams(this.companyId);
  @override
  List<Object?> get props => [companyId];
}

class GetShiftsUseCase implements UseCase<List<ShiftEntity>, CompanyParams> {
  final ShiftRepository repository;
  GetShiftsUseCase(this.repository);
  @override
  Future<Either<Failure, List<ShiftEntity>>> call(CompanyParams params) => repository.getShifts(params.companyId);
}

class GetMyShiftLogsUseCase implements UseCase<List<ShiftLogEntity>, CompanyParams> {
  final ShiftRepository repository;
  GetMyShiftLogsUseCase(this.repository);
  @override
  Future<Either<Failure, List<ShiftLogEntity>>> call(CompanyParams params) => repository.getMyShiftLogs(params.companyId);
}

class OpenShiftParams extends Equatable {
  final String companyId;
  final String shiftId;
  final String? stationId;
  const OpenShiftParams({required this.companyId, required this.shiftId, this.stationId});
  @override
  List<Object?> get props => [companyId, shiftId, stationId];
}

class OpenShiftUseCase implements UseCase<ShiftLogEntity, OpenShiftParams> {
  final ShiftRepository repository;
  OpenShiftUseCase(this.repository);
  @override
  Future<Either<Failure, ShiftLogEntity>> call(OpenShiftParams params) =>
      repository.openShift(params.companyId, params.shiftId, stationId: params.stationId);
}

class CloseShiftParams extends Equatable {
  final String companyId;
  final String shiftLogId;
  const CloseShiftParams({required this.companyId, required this.shiftLogId});
  @override
  List<Object?> get props => [companyId, shiftLogId];
}

class CloseShiftUseCase implements UseCase<ShiftLogEntity, CloseShiftParams> {
  final ShiftRepository repository;
  CloseShiftUseCase(this.repository);
  @override
  Future<Either<Failure, ShiftLogEntity>> call(CloseShiftParams params) =>
      repository.closeShift(params.companyId, params.shiftLogId);
}
