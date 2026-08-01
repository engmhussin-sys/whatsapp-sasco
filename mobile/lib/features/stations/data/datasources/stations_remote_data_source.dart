import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/station_models.dart';

abstract class StationsRemoteDataSource {
  Future<List<StationModel>> getStations(String companyId);
  Future<StationModel> getStation(String companyId, String id);
  Future<void> updateTankLevel(String companyId, String tankId, double level);
}

class StationsRemoteDataSourceImpl implements StationsRemoteDataSource {
  final DioClient _client;
  StationsRemoteDataSourceImpl(this._client);

  @override
  Future<List<StationModel>> getStations(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.stations(companyId));
    return data.map((e) => StationModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<StationModel> getStation(String companyId, String id) async {
    final data = await _client.get<Map<String, dynamic>>(ApiConstants.stationById(companyId, id));
    return StationModel.fromJson(data);
  }

  @override
  Future<void> updateTankLevel(String companyId, String tankId, double level) async {
    await _client.patch<dynamic>(ApiConstants.updateTankLevel(companyId, tankId), data: {'level': level});
  }
}
