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

  /// Uploads the photo FIRST and returns its URL — call this, then pass
  /// the result into reportHazard's photoUrl param. Two real network
  /// calls under the hood, matching how the backend is built (a
  /// standalone small upload endpoint, not a multipart create).
  Future<Either<Failure, String>> uploadHazardPhoto(String companyId, String filePath);

  Future<Either<Failure, SosAlertEntity>> raiseSos(String companyId, {String? stationId, double? latitude, double? longitude});
}
