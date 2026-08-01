import 'package:equatable/equatable.dart';

class TankEntity extends Equatable {
  final String id;
  final String code;
  final String fuelType;
  final double capacityLiters;
  final double? lastKnownLevel;

  const TankEntity({
    required this.id,
    required this.code,
    required this.fuelType,
    required this.capacityLiters,
    this.lastKnownLevel,
  });

  double get fillPercentage => lastKnownLevel == null ? 0 : (lastKnownLevel! / capacityLiters).clamp(0, 1);

  @override
  List<Object?> get props => [id, code, fuelType, capacityLiters, lastKnownLevel];
}

class StationEntity extends Equatable {
  final String id;
  final String name;
  final String code;
  final List<TankEntity> tanks;

  const StationEntity({required this.id, required this.name, required this.code, this.tanks = const []});

  @override
  List<Object?> get props => [id, name, code, tanks];
}
