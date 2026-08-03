import 'package:dio/dio.dart' as dio;
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/entities/hazard_report_entity.dart';
import '../models/hazard_report_model.dart';
import '../models/sos_alert_model.dart';

abstract class SafetyRemoteDataSource {
  Future<HazardReportModel> reportHazard(String companyId, {required HazardKind kind, String? stationId, String? note, String? photoUrl});
  Future<List<HazardReportModel>> listHazards(String companyId);
  Future<SosAlertModel> raiseSos(String companyId, {String? stationId, double? latitude, double? longitude});
  Future<String> uploadHazardPhoto(String companyId, String filePath);
}

class SafetyRemoteDataSourceImpl implements SafetyRemoteDataSource {
  final DioClient _client;
  SafetyRemoteDataSourceImpl(this._client);

  @override
  Future<HazardReportModel> reportHazard(
    String companyId, {
    required HazardKind kind,
    String? stationId,
    String? note,
    String? photoUrl,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.hazards(companyId),
      data: {
        'kind': kind.apiValue,
        if (stationId != null) 'stationId': stationId,
        if (note != null) 'note': note,
        if (photoUrl != null) 'photoUrl': photoUrl,
      },
    );
    return HazardReportModel.fromJson(data);
  }

  @override
  Future<List<HazardReportModel>> listHazards(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.hazards(companyId));
    return data.map((e) => HazardReportModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<SosAlertModel> raiseSos(String companyId, {String? stationId, double? latitude, double? longitude}) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.sos(companyId),
      data: {
        if (stationId != null) 'stationId': stationId,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    return SosAlertModel.fromJson(data);
  }

  @override
  Future<String> uploadHazardPhoto(String companyId, String filePath) async {
    final formData = dio.FormData.fromMap({'file': await dio.MultipartFile.fromFile(filePath)});
    final data = await _client.post<Map<String, dynamic>>(ApiConstants.hazardPhoto(companyId), data: formData);
    return data['url'] as String;
  }
}
