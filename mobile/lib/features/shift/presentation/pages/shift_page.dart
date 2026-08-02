import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../domain/entities/shift_entity.dart';
import '../bloc/shift_cubit.dart';

class ShiftPage extends StatelessWidget {
  final UserEntity currentUser;
  const ShiftPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ShiftCubit>(param1: currentUser.companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('الورديات')),
        body: BlocBuilder<ShiftCubit, ShiftScreenState>(
          builder: (context, state) {
            if (state.status == ShiftScreenStatus.loading || state.status == ShiftScreenStatus.initial) {
              return const LoadingView();
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (state.errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Text(state.errorMessage!, style: TextStyle(color: Colors.red.shade700)),
                  ),
                if (state.openLog != null)
                  Card(
                    color: Colors.green.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('وردية مفتوحة حاليًا: ${state.openLog!.shiftName ?? ''}'),
                          Text('بدأت: ${state.openLog!.startedAt.hour}:${state.openLog!.startedAt.minute.toString().padLeft(2, '0')}'),
                          const SizedBox(height: 10),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                            onPressed: state.isBusy ? null : () => context.read<ShiftCubit>().closeShift(state.openLog!.id),
                            child: const Text('إغلاق الوردية'),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('اختر وردية لفتحها'),
                          const SizedBox(height: 8),
                          for (final shift in state.shifts)
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text('${shift.name} (${shift.startTime}–${shift.endTime})'),
                              trailing: ElevatedButton(
                                onPressed: state.isBusy ? null : () => context.read<ShiftCubit>().open(shift.id),
                                child: const Text('فتح'),
                              ),
                            ),
                          if (state.shifts.isEmpty) const Text('لم يُعرّف مدير الشركة أي وردية بعد'),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                Text('سجل ورديّاتي', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final log in state.myLogs)
                  ListTile(
                    title: Text(log.shiftName ?? '—'),
                    subtitle: Text('${log.startedAt}${log.endedAt != null ? ' → ${log.endedAt}' : ''}'),
                    trailing: Text(
                      log.status == ShiftLogStatus.open ? 'مفتوحة' : 'مغلقة',
                      style: TextStyle(color: log.status == ShiftLogStatus.open ? Colors.green : Colors.grey),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
