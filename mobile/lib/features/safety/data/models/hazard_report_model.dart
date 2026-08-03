import '../../domain/entities/hazard_report_entity.dart';

extension HazardKindApi on HazardKind {
  String get apiValue => switch (this) {
        HazardKind.fuelLeak => 'FUEL_LEAK',
        HazardKind.fireSmoke => 'FIRE_SMOKE',
        HazardKind.slipperyFloor => 'SLIPPERY_FLOOR',
        HazardKind.electrical => 'ELECTRICAL',
        HazardKind.other => 'OTHER',
      };
}

HazardKind _kindFromApi(String v) => switch (v) {
      'FUEL_LEAK' => HazardKind.fuelLeak,
      'FIRE_SMOKE' => HazardKind.fireSmoke,
      'SLIPPERY_FLOOR' => HazardKind.slipperyFloor,
      'ELECTRICAL' => HazardKind.electrical,
      _ => HazardKind.other,
    };

HazardStatus _statusFromApi(String v) => switch (v) {
      'IN_PROGRESS' => HazardStatus.inProgress,
      'CLOSED' => HazardStatus.closed,
      _ => HazardStatus.open,
    };

class HazardReportModel extends HazardReportEntity {
  const HazardReportModel({
    required super.id,
    required super.kind,
    super.note,
    super.photoUrl,
    required super.status,
    required super.createdAt,
  });

  factory HazardReportModel.fromJson(Map<String, dynamic> json) => HazardReportModel(
        id: json['id'] as String,
        kind: _kindFromApi(json['kind'] as String),
        note: json['note'] as String?,
        photoUrl: json['photoUrl'] as String?,
        status: _statusFromApi(json['status'] as String? ?? 'OPEN'),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
