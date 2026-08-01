import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../domain/entities/task_entity.dart';
import '../bloc/tasks_bloc.dart';

const _statusLabels = {
  TaskStatus.draft: 'مسودة',
  TaskStatus.assigned: 'مُسندة',
  TaskStatus.inProgress: 'قيد التنفيذ',
  TaskStatus.submitted: 'أُرسلت',
  TaskStatus.approved: 'معتمدة',
  TaskStatus.rejected: 'مرفوضة',
  TaskStatus.returned: 'أُعيدت',
  TaskStatus.completed: 'مكتملة',
  TaskStatus.canceled: 'ملغاة',
};

class TaskListPage extends StatelessWidget {
  final UserEntity currentUser;
  const TaskListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<TasksBloc>(param1: currentUser.companyId, param2: currentUser.id)..add(const TasksRequested()),
      child: Scaffold(
        appBar: AppBar(title: const Text('المهام')),
        body: BlocBuilder<TasksBloc, TasksState>(
          builder: (context, state) {
            if (state.status == TasksStatus.loading || state.status == TasksStatus.initial) return const LoadingView();
            if (state.status == TasksStatus.failure) {
              return ErrorView(
                message: state.errorMessage ?? 'تعذّر جلب المهام',
                onRetry: () => context.read<TasksBloc>().add(const TasksRequested()),
              );
            }
            if (state.tasks.isEmpty) return const Center(child: Text('لا توجد مهام حاليًا'));
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: state.tasks.length,
              itemBuilder: (context, index) {
                final task = state.tasks[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(task.title),
                    subtitle: task.description != null ? Text(task.description!) : null,
                    trailing: Chip(label: Text(_statusLabels[task.status] ?? '')),
                    onTap: () => context.push(RouteNames.taskDetailsPath(task.id)),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
