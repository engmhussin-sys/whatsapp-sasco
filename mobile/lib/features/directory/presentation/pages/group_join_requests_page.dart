import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../cubit/pending_requests_cubit.dart';

class GroupJoinRequestsPage extends StatelessWidget {
  final String companyId;
  final String conversationId;
  final String groupTitle;

  const GroupJoinRequestsPage({super.key, required this.companyId, required this.conversationId, required this.groupTitle});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<PendingRequestsCubit>(param1: companyId, param2: conversationId)..load(),
      child: Scaffold(
        appBar: AppBar(title: Text('طلبات الانضمام — $groupTitle')),
        body: BlocConsumer<PendingRequestsCubit, PendingRequestsState>(
          listenWhen: (p, c) => c.errorMessage != null && c.errorMessage != p.errorMessage,
          listener: (context, state) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
          },
          builder: (context, state) {
            if (state.status == PendingRequestsStatus.loading && state.requests.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.requests.isEmpty) {
              return const Center(child: Text('لا توجد طلبات انضمام حاليًا', style: TextStyle(color: AppColors.textSecondary)));
            }
            return RefreshIndicator(
              onRefresh: () => context.read<PendingRequestsCubit>().load(),
              child: ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: state.requests.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (context, i) {
                  final req = state.requests[i];
                  final isDeciding = state.decidingRequestId == req.id;
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
                          radius: 20,
                          backgroundColor: AppColors.brandLight,
                          child: Text(
                            req.requesterName.isNotEmpty ? req.requesterName[0] : '?',
                            style: const TextStyle(color: AppColors.brandDark, fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(req.requesterName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        ),
                        if (isDeciding)
                          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        else ...[
                          IconButton(
                            icon: const Icon(Icons.check_circle_rounded, color: AppColors.brand),
                            onPressed: () => context.read<PendingRequestsCubit>().decide(req.id, approve: true),
                            tooltip: 'قبول',
                          ),
                          IconButton(
                            icon: const Icon(Icons.cancel_rounded, color: AppColors.danger),
                            onPressed: () => context.read<PendingRequestsCubit>().decide(req.id, approve: false),
                            tooltip: 'رفض',
                          ),
                        ],
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
}
