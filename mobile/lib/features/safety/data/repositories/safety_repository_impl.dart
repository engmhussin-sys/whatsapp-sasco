import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../domain/entities/hazard_report_entity.dart';
import '../../domain/entities/sos_alert_entity.dart';
import '../../domain/repositories/safety_repository.dart';
import '../datasources/safety_remote_data_source.dart';

class SafetyRepositoryImpl implements SafetyRepository {
  final SafetyRemoteDataSource _remote;
  final NetworkInfo _networkInfo;

  SafetyRepositoryImpl({required SafetyRemoteDataSource remote, required NetworkInfo networkInfo})
      : _remote = remote,
        _networkInfo = networkInfo;

  @override
  Future<Either<Failure, HazardReportEntity>> reportHazard(
    String companyId, {
    required HazardKind kind,
    String? stationId,
    String? note,
    String? photoUrl,
  }) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final result = await _remote.reportHazard(companyId, kind: kind, stationId: stationId, note: note, photoUrl: photoUrl);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر إرسال البلاغ: $e'));
    }
  }

  @override
  Future<Either<Failure, List<HazardReportEntity>>> listHazards(String companyId) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final result = await _remote.listHazards(companyId);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, String>> uploadHazardPhoto(String companyId, String filePath) async {
    if (!await _networkInfo.isConnected) return const Left(NetworkFailure());
    try {
      final url = await _remote.uploadHazardPhoto(companyId, filePath);
      return Right(url);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر رفع الصورة: $e'));
    }
  }

  @override
  Future<Either<Failure, SosAlertEntity>> raiseSos(String companyId, {String? stationId, double? latitude, double? longitude}) async {
    // SOS is deliberately allowed to attempt even on a flaky connection —
    // the network check is skipped here; a failed request simply surfaces
    // as an error the UI can show ("عاود المحاولة") rather than silently
    // refusing to even try during a life-safety event.
    try {
      final result = await _remote.raiseSos(companyId, stationId: stationId, latitude: latitude, longitude: longitude);
      return Right(result);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } catch (e) {
      return Left(ServerFailure('تعذّر إرسال الاستغاثة: $e'));
    }
  }
}
