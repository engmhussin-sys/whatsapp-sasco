import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/shift_models.dart';

abstract class ShiftRemoteDataSource {
  Future<List<ShiftModel>> getShifts(String companyId);
  Future<List<ShiftLogModel>> getMyShiftLogs(String companyId);
  Future<ShiftLogModel> openShift(String companyId, String shiftId, {String? stationId});
  Future<ShiftLogModel> closeShift(String companyId, String shiftLogId);
}

class ShiftRemoteDataSourceImpl implements ShiftRemoteDataSource {
  final DioClient _client;
  ShiftRemoteDataSourceImpl(this._client);

  @override
  Future<List<ShiftModel>> getShifts(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.shifts(companyId));
    return data.map((e) => ShiftModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<ShiftLogModel>> getMyShiftLogs(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.shiftLogsMine(companyId));
    return data.map((e) => ShiftLogModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<ShiftLogModel> openShift(String companyId, String shiftId, {String? stationId}) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.openShiftLog(companyId),
      data: {'shiftId': shiftId, if (stationId != null) 'stationId': stationId},
    );
    return ShiftLogModel.fromJson(data);
  }

  @override
  Future<ShiftLogModel> closeShift(String companyId, String shiftLogId) async {
    final data = await _client.post<Map<String, dynamic>>(ApiConstants.closeShiftLog(companyId, shiftLogId), data: {});
    return ShiftLogModel.fromJson(data);
  }
}
