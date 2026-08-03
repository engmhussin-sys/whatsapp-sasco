import 'package:equatable/equatable.dart';

enum HazardKind { fuelLeak, fireSmoke, slipperyFloor, electrical, other }
enum HazardStatus { open, inProgress, closed }

class HazardReportEntity extends Equatable {
  final String id;
  final HazardKind kind;
  final String? note;
  final String? photoUrl;
  final HazardStatus status;
  final DateTime createdAt;

  const HazardReportEntity({
    required this.id,
    required this.kind,
    this.note,
    this.photoUrl,
    required this.status,
    required this.createdAt,
  });

  @override
  List<Object?> get props => [id, kind, note, photoUrl, status, createdAt];
}
