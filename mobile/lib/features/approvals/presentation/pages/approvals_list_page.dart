import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../domain/entities/approval_entity.dart';
import '../bloc/approvals_cubit.dart';

class ApprovalsListPage extends StatelessWidget {
  final UserEntity currentUser;
  const ApprovalsListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ApprovalsCubit>(param1: currentUser.companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('الموافقات المُعلَّقة')),
        body: BlocBuilder<ApprovalsCubit, ApprovalsState>(
          builder: (context, state) {
            if (state.status == ApprovalsStatus.loading || state.status == ApprovalsStatus.initial) return const LoadingView();
            if (state.status == ApprovalsStatus.failure) {
              return ErrorView(message: state.errorMessage ?? 'تعذّر جلب الموافقات', onRetry: () => context.read<ApprovalsCubit>().load());
            }
            if (state.approvals.isEmpty) return const Center(child: Text('لا توجد موافقات معلّقة بانتظارك'));

            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: state.approvals.length,
              itemBuilder: (context, index) {
                final approval = state.approvals[index];
                final busy = state.actingOnId == approval.id;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('طلب #${approval.id.substring(0, 8)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        if (approval.currentStepDef != null)
                          Text('الخطوة: ${approval.currentStepDef!.name} (${approval.currentStepDef!.approverRoleName})'),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            _ActionButton(
                              label: 'موافقة',
                              color: Colors.green,
                              busy: busy,
                              onTap: () => context.read<ApprovalsCubit>().act(approval.id, ApprovalActionType.approve),
                            ),
                            const SizedBox(width: 8),
                            _ActionButton(
                              label: 'إعادة',
                              color: Colors.amber.shade700,
                              busy: busy,
                              onTap: () => context.read<ApprovalsCubit>().act(approval.id, ApprovalActionType.returnAction),
                            ),
                            const SizedBox(width: 8),
                            _ActionButton(
                              label: 'رفض',
                              color: Colors.red,
                              busy: busy,
                              onTap: () => context.read<ApprovalsCubit>().act(approval.id, ApprovalActionType.reject),
                            ),
                          ],
                        ),
                      ],
                    ),
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

class _ActionButton extends StatelessWidget {
  final String label;
  final Color color;
  final bool busy;
  final VoidCallback onTap;

  const _ActionButton({required this.label, required this.color, required this.busy, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(backgroundColor: color, padding: const EdgeInsets.symmetric(vertical: 8)),
        onPressed: busy ? null : onTap,
        child: Text(label, style: const TextStyle(fontSize: 13)),
      ),
    );
  }
}
