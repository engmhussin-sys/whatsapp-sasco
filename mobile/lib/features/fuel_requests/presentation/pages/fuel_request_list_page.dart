import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../domain/entities/fuel_request_entity.dart';
import '../bloc/fuel_requests_cubit.dart';

const _statusLabels = {
  FuelRequestStatus.draft: 'مسودة',
  FuelRequestStatus.pendingSupervisor: 'بانتظار المشرف',
  FuelRequestStatus.pendingManager: 'بانتظار المدير',
  FuelRequestStatus.approved: 'مُعتمَد',
  FuelRequestStatus.rejected: 'مرفوض',
  FuelRequestStatus.completed: 'مكتمل',
};

class FuelRequestListPage extends StatelessWidget {
  final UserEntity currentUser;
  const FuelRequestListPage({super.key, required this.currentUser});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<FuelRequestsCubit>(param1: currentUser.companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('طلبات الوقود')),
        floatingActionButton: FloatingActionButton(
          onPressed: () => context.push(RouteNames.createFuelRequest),
          child: const Icon(Icons.add),
        ),
        body: BlocBuilder<FuelRequestsCubit, FuelRequestsState>(
          builder: (context, state) {
            if (state.status == FuelRequestsStatus.loading || state.status == FuelRequestsStatus.initial) {
              return const LoadingView();
            }
            if (state.requests.isEmpty) return const Center(child: Text('لا توجد طلبات وقود بعد'));
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: state.requests.length,
              itemBuilder: (context, index) {
                final r = state.requests[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(r.stationName ?? 'محطة'),
                    subtitle: Text('الكمية المطلوبة: ${r.requestedQuantity} لتر — المستوى الحالي: ${r.currentLevel}'),
                    trailing: Chip(label: Text(_statusLabels[r.status] ?? '')),
                    onTap: () => context.push(RouteNames.fuelRequestDetailsPath(r.id)),
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
