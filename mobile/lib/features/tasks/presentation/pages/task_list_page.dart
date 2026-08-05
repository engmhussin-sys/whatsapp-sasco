import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
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

const _statusColors = {
  TaskStatus.draft: AppColors.textSecondary,
  TaskStatus.assigned: AppColors.brand,
  TaskStatus.inProgress: AppColors.brand,
  TaskStatus.submitted: AppColors.accent,
  TaskStatus.approved: AppColors.success,
  TaskStatus.completed: AppColors.success,
  TaskStatus.rejected: AppColors.danger,
  TaskStatus.returned: AppColors.danger,
  TaskStatus.canceled: AppColors.textSecondary,
};

/// Design-system rebuild to match profile_page.dart's language exactly:
/// gradient header, white cards with divider border (no shadow, radius
/// 16), status color-coded badge instead of a generic Chip.
class TaskListPage extends StatelessWidget {
  final UserEntity currentUser;
  const TaskListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<TasksBloc>(param1: currentUser.companyId, param2: currentUser.id)..add(const TasksRequested()),
      child: Scaffold(
        backgroundColor: AppColors.surfaceLight,
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [AppColors.brand, AppColors.brandDark]),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
                ),
                child: const Text('المهام', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              ),
            ),
            BlocBuilder<TasksBloc, TasksState>(
              builder: (context, state) {
                if (state.status == TasksStatus.loading || state.status == TasksStatus.initial) {
                  return const SliverFillRemaining(child: LoadingView());
                }
                if (state.status == TasksStatus.failure) {
                  return SliverFillRemaining(
                    child: ErrorView(
                      message: state.errorMessage ?? 'تعذّر جلب المهام',
                      onRetry: () => context.read<TasksBloc>().add(const TasksRequested()),
                    ),
                  );
                }
                if (state.tasks.isEmpty) {
                  return const SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.checklist_rounded, size: 48, color: AppColors.textSecondary),
                          SizedBox(height: 12),
                          Text('لا توجد مهام حاليًا', style: TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final task = state.tasks[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _StaggeredEntry(
                            index: index,
                            child: _TaskCard(task: task, onTap: () => context.push(RouteNames.taskDetailsPath(task.id))),
                          ),
                        );
                      },
                      childCount: state.tasks.length,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// V3 rebrand animation directive: task cards enter staggered, 0.05s
/// delay per card index. Deliberately built with the simplest reliable
/// primitives (Future.delayed + AnimatedOpacity/AnimatedSlide) rather
/// than a full AnimationController — this widget's only job is a
/// one-shot entry animation, so there's no ongoing animation to manage
/// or dispose, and no risk to TasksBloc/the list's own logic since this
/// is purely an additional render-layer wrapper.
class _StaggeredEntry extends StatefulWidget {
  final int index;
  final Widget child;
  const _StaggeredEntry({required this.index, required this.child});

  @override
  State<_StaggeredEntry> createState() => _StaggeredEntryState();
}

class _StaggeredEntryState extends State<_StaggeredEntry> {
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(Duration(milliseconds: 50 * widget.index), () {
      if (mounted) setState(() => _visible = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      offset: _visible ? Offset.zero : const Offset(0, 0.08),
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: _visible ? 1 : 0,
        duration: const Duration(milliseconds: 260),
        child: widget.child,
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final TaskEntity task;
  final VoidCallback onTap;
  const _TaskCard({required this.task, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[task.status] ?? AppColors.textSecondary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(16)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 4,
              height: 44,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(task.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                  if (task.description != null) ...[
                    const SizedBox(height: 3),
                    Text(task.description!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ],
                  if (task.dueAt != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.schedule_rounded, size: 13, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Text('${task.dueAt!.day}/${task.dueAt!.month}/${task.dueAt!.year}', style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
              child: Text(
                _statusLabels[task.status] ?? '',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
