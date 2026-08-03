import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/hazard_report_entity.dart';
import '../entities/sos_alert_entity.dart';

abstract class SafetyRepository {
  Future<Either<Failure, HazardReportEntity>> reportHazard(
    String companyId, {
    required HazardKind kind,
    String? stationId,
    String? note,
    String? photoUrl,
  });

  Future<Either<Failure, List<HazardReportEntity>>> listHazards(String companyId);

  Future<Either<Failure, SosAlertEntity>> raiseSos(String companyId, {String? stationId, double? latitude, double? longitude});
}
