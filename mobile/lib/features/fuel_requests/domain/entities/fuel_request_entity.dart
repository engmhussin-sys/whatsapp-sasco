import 'package:equatable/equatable.dart';

enum FuelRequestStatus { draft, pendingSupervisor, pendingManager, approved, rejected, completed }

FuelRequestStatus fuelRequestStatusFromString(String v) {
  const map = {
    'DRAFT': FuelRequestStatus.draft,
    'PENDING_SUPERVISOR': FuelRequestStatus.pendingSupervisor,
    'PENDING_MANAGER': FuelRequestStatus.pendingManager,
    'APPROVED': FuelRequestStatus.approved,
    'REJECTED': FuelRequestStatus.rejected,
    'COMPLETED': FuelRequestStatus.completed,
  };
  return map[v] ?? FuelRequestStatus.draft;
}

class FuelRequestEntity extends Equatable {
  final String id;
  final String stationId;
  final String? stationName;
  final String tankId;
  final double currentLevel;
  final double requestedQuantity;
  final String? notes;
  final FuelRequestStatus status;
  final DateTime createdAt;

  const FuelRequestEntity({
    required this.id,
    required this.stationId,
    this.stationName,
    required this.tankId,
    required this.currentLevel,
    required this.requestedQuantity,
    this.notes,
    required this.status,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id, stationId, tankId, currentLevel, requestedQuantity, notes, status, createdAt];
}
