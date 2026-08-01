import '../../domain/entities/station_entity.dart';

class TankModel extends TankEntity {
  const TankModel({
    required super.id,
    required super.code,
    required super.fuelType,
    required super.capacityLiters,
    super.lastKnownLevel,
  });

  factory TankModel.fromJson(Map<String, dynamic> json) => TankModel(
        id: json['id'] as String,
        code: json['code'] as String,
        fuelType: json['fuelType'] as String,
        capacityLiters: (json['capacityLiters'] as num).toDouble(),
        lastKnownLevel: (json['lastKnownLevel'] as num?)?.toDouble(),
      );
}

class StationModel extends StationEntity {
  const StationModel({required super.id, required super.name, required super.code, super.tanks});

  factory StationModel.fromJson(Map<String, dynamic> json) => StationModel(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        tanks: (json['tanks'] as List<dynamic>? ?? []).map((t) => TankModel.fromJson(t as Map<String, dynamic>)).toList(),
      );
}
