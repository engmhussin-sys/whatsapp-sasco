import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../cubit/joinable_groups_cubit.dart';

class BrowseGroupsPage extends StatelessWidget {
  final String companyId;
  const BrowseGroupsPage({super.key, required this.companyId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<JoinableGroupsCubit>(param1: companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('تصفّح المجموعات')),
        body: BlocConsumer<JoinableGroupsCubit, JoinableGroupsState>(
          listenWhen: (p, c) => c.errorMessage != null && c.errorMessage != p.errorMessage,
          listener: (context, state) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
          },
          builder: (context, state) {
            if (state.status == JoinableGroupsStatus.loading && state.groups.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.status == JoinableGroupsStatus.failure && state.groups.isEmpty) {
              return Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(state.errorMessage ?? 'حدث خطأ', style: const TextStyle(color: AppColors.danger)),
                    const SizedBox(height: 8),
                    TextButton(onPressed: () => context.read<JoinableGroupsCubit>().load(), child: const Text('إعادة المحاولة')),
                  ],
                ),
              );
            }
            if (state.groups.isEmpty) {
              return const Center(child: Text('لا توجد مجموعات متاحة للانضمام حاليًا', style: TextStyle(color: AppColors.textSecondary)));
            }
            return RefreshIndicator(
              onRefresh: () => context.read<JoinableGroupsCubit>().load(),
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: state.groups.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final group = state.groups[i];
                  final isRequesting = state.requestingGroupId == group.id;
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: AppColors.divider),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: AppColors.brandLight,
                          child: const Icon(Icons.groups_rounded, color: AppColors.brandDark),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(group.title ?? 'مجموعة', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                              const SizedBox(height: 2),
                              Text('${group.memberCount} عضو', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                        _buildActionButton(context, group, isRequesting),
                      ],
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildActionButton(BuildContext context, dynamic group, bool isRequesting) {
    if (group.hasPendingRequest as bool) {
      return const Chip(
        label: Text('قيد المراجعة', style: TextStyle(fontSize: 11)),
        backgroundColor: AppColors.surfaceLight,
        visualDensity: VisualDensity.compact,
      );
    }
    if (group.wasRejected as bool) {
      return OutlinedButton(
        onPressed: isRequesting ? null : () => context.read<JoinableGroupsCubit>().requestToJoin(group.id as String),
        style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, side: const BorderSide(color: AppColors.danger)),
        child: isRequesting
            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
            : const Text('أُعِد المحاولة', style: TextStyle(fontSize: 12, color: AppColors.danger)),
      );
    }
    return ElevatedButton(
      onPressed: isRequesting ? null : () => context.read<JoinableGroupsCubit>().requestToJoin(group.id as String),
      style: ElevatedButton.styleFrom(visualDensity: VisualDensity.compact),
      child: isRequesting
          ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : const Text('طلب الانضمام', style: TextStyle(fontSize: 12)),
    );
  }
}
