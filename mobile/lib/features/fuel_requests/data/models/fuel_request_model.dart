import '../../domain/entities/fuel_request_entity.dart';

class FuelRequestModel extends FuelRequestEntity {
  const FuelRequestModel({
    required super.id,
    required super.stationId,
    super.stationName,
    required super.tankId,
    required super.currentLevel,
    required super.requestedQuantity,
    super.notes,
    required super.status,
    required super.createdAt,
  });

  factory FuelRequestModel.fromJson(Map<String, dynamic> json) => FuelRequestModel(
        id: json['id'] as String,
        stationId: json['stationId'] as String,
        stationName: (json['station'] as Map<String, dynamic>?)?['name'] as String?,
        tankId: json['tankId'] as String,
        currentLevel: (json['currentLevel'] as num).toDouble(),
        requestedQuantity: (json['requestedQuantity'] as num).toDouble(),
        notes: json['notes'] as String?,
        status: fuelRequestStatusFromString(json['status'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
