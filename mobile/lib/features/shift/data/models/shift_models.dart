import '../../domain/entities/shift_entity.dart';

class ShiftModel extends ShiftEntity {
  const ShiftModel({required super.id, required super.name, required super.startTime, required super.endTime});

  factory ShiftModel.fromJson(Map<String, dynamic> json) => ShiftModel(
        id: json['id'] as String,
        name: json['name'] as String,
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
      );
}

class ShiftLogModel extends ShiftLogEntity {
  const ShiftLogModel({
    required super.id,
    required super.shiftId,
    super.shiftName,
    required super.status,
    required super.startedAt,
    super.endedAt,
  });

  factory ShiftLogModel.fromJson(Map<String, dynamic> json) => ShiftLogModel(
        id: json['id'] as String,
        shiftId: json['shiftId'] as String,
        shiftName: (json['shift'] as Map<String, dynamic>?)?['name'] as String?,
        status: json['status'] == 'CLOSED' ? ShiftLogStatus.closed : ShiftLogStatus.open,
        startedAt: DateTime.parse(json['startedAt'] as String),
        endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      );
}
