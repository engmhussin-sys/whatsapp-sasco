import '../../domain/entities/task_entity.dart';

class TaskModel extends TaskEntity {
  const TaskModel({
    required super.id,
    required super.title,
    super.description,
    required super.status,
    super.templateFields,
    super.dueAt,
    required super.createdAt,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    List<TaskFieldEntity>? fields;
    final template = json['template'] as Map<String, dynamic>?;
    if (template != null && template['fields'] != null) {
      fields = (template['fields'] as List<dynamic>).map((f) {
        final map = f as Map<String, dynamic>;
        return TaskFieldEntity(
          id: map['id'] as String,
          type: taskFieldTypeFromString(map['type'] as String),
          label: map['label'] as String,
          required: map['required'] as bool? ?? false,
          options: (map['options'] as List<dynamic>?)?.map((e) => e.toString()).toList(),
        );
      }).toList();
    }

    return TaskModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      status: taskStatusFromString(json['status'] as String),
      templateFields: fields,
      dueAt: json['dueAt'] != null ? DateTime.parse(json['dueAt'] as String).toLocal() : null,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
    );
  }
}
