import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../domain/entities/task_entity.dart';
import '../bloc/task_detail_cubit.dart';
import '../widgets/dynamic_form_field_widget.dart';

class TaskDetailsPage extends StatelessWidget {
  final String companyId;
  final String taskId;

  const TaskDetailsPage({super.key, required this.companyId, required this.taskId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<TaskDetailCubit>(param1: companyId, param2: taskId)..load(),
      child: const _TaskDetailsView(),
    );
  }
}

class _TaskDetailsView extends StatefulWidget {
  const _TaskDetailsView();

  @override
  State<_TaskDetailsView> createState() => _TaskDetailsViewState();
}

class _TaskDetailsViewState extends State<_TaskDetailsView> {
  final Map<String, dynamic> _answers = {};
  final Map<String, String> _files = {};
  final Map<String, String> _fieldKinds = {};

  /// Maps a TaskFieldType to the backend's AttachmentKind enum (see
  /// backend/prisma/schema.prisma: IMAGE/VIDEO/AUDIO/DOCUMENT/SIGNATURE).
  /// These two enums are named differently on purpose — TaskFieldType
  /// describes the FORM FIELD's semantics ("this is a photo field"),
  /// AttachmentKind describes the STORED FILE's media type — so PHOTO
  /// correctly maps to IMAGE, not to a field named "PHOTO" that doesn't
  /// exist server-side.
  String _attachmentKindFor(TaskFieldType type) {
    switch (type) {
      case TaskFieldType.photo:
        return 'IMAGE';
      case TaskFieldType.video:
        return 'VIDEO';
      case TaskFieldType.audio:
        return 'AUDIO';
      case TaskFieldType.signature:
        return 'SIGNATURE';
      default:
        return 'DOCUMENT';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل المهمة')),
      body: BlocConsumer<TaskDetailCubit, TaskDetailState>(
        listener: (context, state) {
          if (state.status == TaskDetailStatus.submitted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إرسال المهمة بنجاح')));
            Navigator.of(context).pop();
          } else if (state.status == TaskDetailStatus.failure && state.task != null) {
            // BUG FIX (confirmed real: user reported "nothing happens" on
            // submit) — TaskDetailCubit.submit() already emits `failure`
            // with a real errorMessage on any server/network error, but
            // this listener never checked for it. The submit button just
            // silently re-enabled itself with zero visible feedback,
            // making every failure look identical to "the button did
            // nothing". `state.task != null` distinguishes this from the
            // initial LOAD failure (handled separately below by ErrorView
            // replacing the whole screen) — this branch is specifically
            // for a failure that happens AFTER the task loaded fine, i.e.
            // during submit.
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.errorMessage ?? 'تعذّر إرسال المهمة — حاول مرة أخرى'),
                backgroundColor: Colors.red.shade700,
                duration: const Duration(seconds: 5),
              ),
            );
          }
        },
        builder: (context, state) {
          if (state.status == TaskDetailStatus.loading || state.status == TaskDetailStatus.initial) {
            return const LoadingView();
          }
          if (state.status == TaskDetailStatus.failure && state.task == null) {
            return ErrorView(message: state.errorMessage ?? 'تعذّر جلب المهمة', onRetry: () => context.read<TaskDetailCubit>().load());
          }

          final task = state.task!;
          final canSubmit = task.status == TaskStatus.draft || task.status == TaskStatus.assigned || task.status == TaskStatus.inProgress;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(task.title, style: Theme.of(context).textTheme.titleLarge),
                if (task.description != null) ...[
                  const SizedBox(height: 4),
                  Text(task.description!, style: Theme.of(context).textTheme.bodyMedium),
                ],
                const SizedBox(height: 16),
                // تفعيل حالة IN_PROGRESS — كانت موجودة في الـenum بلا أي
                // مسار يُطلقها إطلاقاً. زر "بدء المهمة" يظهر فقط في حالة
                // ASSIGNED (يطابق ما يتحقق منه الخادم بالضبط).
                if (task.status == TaskStatus.assigned)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: OutlinedButton.icon(
                      onPressed: () => context.read<TaskDetailCubit>().start(),
                      icon: const Icon(Icons.play_arrow_rounded),
                      label: const Text('بدء المهمة'),
                    ),
                  ),
                if (!canSubmit)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
                    child: const Text('تم إرسال هذه المهمة مسبقًا.'),
                  )
                else if (task.templateFields != null) ...[
                  for (final field in task.templateFields!)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: DynamicFormFieldWidget(
                        field: field,
                        value: _answers[field.id],
                        filePath: _files[field.id],
                        onValueChanged: (v) => setState(() => _answers[field.id] = v),
                        onFileSelected: (path) => setState(() {
                          _files[field.id] = path;
                          _fieldKinds[field.id] = _attachmentKindFor(field.type);
                        }),
                      ),
                    ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: state.status == TaskDetailStatus.submitting
                        ? null
                        : () => context.read<TaskDetailCubit>().submit(
                              answers: _answers,
                              filesByField: _files,
                              fieldKinds: _fieldKinds,
                            ),
                    child: state.status == TaskDetailStatus.submitting
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('إرسال المهمة'),
                  ),
                ] else
                  const Text('مهمة بسيطة بدون نموذج مرفق'),
              ],
            ),
          );
        },
      ),
    );
  }
}
