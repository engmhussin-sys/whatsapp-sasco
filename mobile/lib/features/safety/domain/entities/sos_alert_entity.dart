import 'package:equatable/equatable.dart';

class SosAlertEntity extends Equatable {
  final String id;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  const SosAlertEntity({required this.id, required this.createdAt, this.resolvedAt});

  bool get isActive => resolvedAt == null;

  @override
  List<Object?> get props => [id, createdAt, resolvedAt];
}
