import '../../domain/entities/sos_alert_entity.dart';

class SosAlertModel extends SosAlertEntity {
  const SosAlertModel({required super.id, required super.createdAt, super.resolvedAt});

  factory SosAlertModel.fromJson(Map<String, dynamic> json) => SosAlertModel(
        id: json['id'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        resolvedAt: json['resolvedAt'] != null ? DateTime.parse(json['resolvedAt'] as String) : null,
      );
}
