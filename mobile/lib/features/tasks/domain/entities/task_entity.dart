import 'package:equatable/equatable.dart';

enum TaskFieldType { text, number, date, time, photo, video, audio, signature, gps, checkbox, dropdown }
enum TaskStatus { draft, assigned, inProgress, submitted, approved, rejected, returned, completed, canceled }

TaskFieldType taskFieldTypeFromString(String v) => TaskFieldType.values.firstWhere(
      (t) => t.name.toUpperCase() == v || _legacyMatch(t, v),
      orElse: () => TaskFieldType.text,
    );

bool _legacyMatch(TaskFieldType t, String v) {
  const map = {
    'TEXT': TaskFieldType.text,
    'NUMBER': TaskFieldType.number,
    'DATE': TaskFieldType.date,
    'TIME': TaskFieldType.time,
    'PHOTO': TaskFieldType.photo,
    'VIDEO': TaskFieldType.video,
    'AUDIO': TaskFieldType.audio,
    'SIGNATURE': TaskFieldType.signature,
    'GPS': TaskFieldType.gps,
    'CHECKBOX': TaskFieldType.checkbox,
    'DROPDOWN': TaskFieldType.dropdown,
  };
  return map[v] == t;
}

TaskStatus taskStatusFromString(String v) {
  const map = {
    'DRAFT': TaskStatus.draft,
    'ASSIGNED': TaskStatus.assigned,
    'IN_PROGRESS': TaskStatus.inProgress,
    'SUBMITTED': TaskStatus.submitted,
    'APPROVED': TaskStatus.approved,
    'REJECTED': TaskStatus.rejected,
    'RETURNED': TaskStatus.returned,
    'COMPLETED': TaskStatus.completed,
    'CANCELED': TaskStatus.canceled,
  };
  return map[v] ?? TaskStatus.draft;
}

class TaskFieldEntity extends Equatable {
  final String id;
  final TaskFieldType type;
  final String label;
  final bool required;
  final List<String>? options;

  const TaskFieldEntity({required this.id, required this.type, required this.label, this.required = false, this.options});

  @override
  List<Object?> get props => [id, type, label, required, options];
}

class TaskEntity extends Equatable {
  final String id;
  final String title;
  final String? description;
  final TaskStatus status;
  final List<TaskFieldEntity>? templateFields;
  final DateTime? dueAt;
  final DateTime createdAt;
  // Task management module (recurrence) — غير فارغة تعني أن هذه النسخة
  // وُلِّدت آلياً من جدول متكرر (RecurringTaskSchedule)، وليست مهمة
  // أُنشئت مباشرة لمرة واحدة. هذا هو "نوع المهمة" فعلياً — بلا حاجة
  // لحقل منفصل، تماماً كما في تصميم الخادم.
  final String? recurringScheduleId;

  const TaskEntity({
    required this.id,
    required this.title,
    this.description,
    required this.status,
    this.templateFields,
    this.dueAt,
    required this.createdAt,
    this.recurringScheduleId,
  });

  bool get isRecurring => recurringScheduleId != null;

  @override
  List<Object?> get props => [id, title, description, status, templateFields, dueAt, createdAt, recurringScheduleId];
}
