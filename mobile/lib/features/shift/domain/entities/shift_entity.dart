import 'package:equatable/equatable.dart';

class ShiftEntity extends Equatable {
  final String id;
  final String name;
  final String startTime;
  final String endTime;
  const ShiftEntity({required this.id, required this.name, required this.startTime, required this.endTime});
  @override
  List<Object?> get props => [id, name, startTime, endTime];
}

enum ShiftLogStatus { open, closed }

class ShiftLogEntity extends Equatable {
  final String id;
  final String shiftId;
  final String? shiftName;
  final ShiftLogStatus status;
  final DateTime startedAt;
  final DateTime? endedAt;

  const ShiftLogEntity({
    required this.id,
    required this.shiftId,
    this.shiftName,
    required this.status,
    required this.startedAt,
    this.endedAt,
  });

  @override
  List<Object?> get props => [id, shiftId, shiftName, status, startedAt, endedAt];
}
