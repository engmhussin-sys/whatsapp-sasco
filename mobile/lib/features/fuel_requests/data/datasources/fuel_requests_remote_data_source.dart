import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/fuel_request_model.dart';

abstract class FuelRequestsRemoteDataSource {
  Future<List<FuelRequestModel>> getFuelRequests(String companyId);
  Future<FuelRequestModel> getFuelRequest(String companyId, String id);
  Future<FuelRequestModel> create(
    String companyId, {
    required String stationId,
    required String tankId,
    required double currentLevel,
    required double requestedQuantity,
    String? notes,
  });
}

class FuelRequestsRemoteDataSourceImpl implements FuelRequestsRemoteDataSource {
  final DioClient _client;
  FuelRequestsRemoteDataSourceImpl(this._client);

  @override
  Future<List<FuelRequestModel>> getFuelRequests(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.fuelRequests(companyId));
    return data.map((e) => FuelRequestModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<FuelRequestModel> getFuelRequest(String companyId, String id) async {
    final data = await _client.get<Map<String, dynamic>>(ApiConstants.fuelRequestById(companyId, id));
    return FuelRequestModel.fromJson(data);
  }

  @override
  Future<FuelRequestModel> create(
    String companyId, {
    required String stationId,
    required String tankId,
    required double currentLevel,
    required double requestedQuantity,
    String? notes,
  }) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.fuelRequests(companyId),
      data: {
        'stationId': stationId,
        'tankId': tankId,
        'currentLevel': currentLevel,
        'requestedQuantity': requestedQuantity,
        if (notes != null) 'notes': notes,
      },
    );
    return FuelRequestModel.fromJson(data);
  }
}
