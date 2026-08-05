import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/locale_numerals.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../domain/entities/station_entity.dart';
import '../bloc/stations_cubit.dart';

class StationListPage extends StatelessWidget {
  final String companyId;
  const StationListPage({super.key, required this.companyId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<StationsCubit>(param1: companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('المحطات')),
        body: BlocBuilder<StationsCubit, StationsState>(
          builder: (context, state) {
            if (state.status == StationsStatus.loading || state.status == StationsStatus.initial) return const LoadingView();
            if (state.stations.isEmpty) return const Center(child: Text('لا توجد محطات بعد'));
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: state.stations.length,
              itemBuilder: (context, index) {
                final station = state.stations[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(station.name),
                    subtitle: Text('${station.tanks.length} خزان — الكود: ${station.code}'),
                    onTap: () => context.push(RouteNames.stationTanksPath(station.id)),
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

class TankLevelsPage extends StatelessWidget {
  final String companyId;
  final String stationId;
  const TankLevelsPage({super.key, required this.companyId, required this.stationId});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<StationsCubit>(param1: companyId)..load(),
      child: Scaffold(
        appBar: AppBar(title: const Text('مستويات الخزانات')),
        body: BlocBuilder<StationsCubit, StationsState>(
          builder: (context, state) {
            if (state.status == StationsStatus.loading || state.status == StationsStatus.initial) return const LoadingView();
            final station = state.stations.where((s) => s.id == stationId).cast<StationEntity?>().firstOrNull();
            if (station == null) return const Center(child: Text('المحطة غير موجودة'));
            return ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: station.tanks.length,
              itemBuilder: (context, index) {
                final tank = station.tanks[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${tank.code} — ${tank.fuelType}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: tank.fillPercentage),
                          duration: const Duration(milliseconds: 550),
                          curve: Curves.easeOut,
                          builder: (context, value, _) => LinearProgressIndicator(value: value),
                        ),
                        const SizedBox(height: 4),
                        Text(LocaleNumerals.format(
                          '${tank.lastKnownLevel?.toStringAsFixed(0) ?? '؟'} / ${tank.capacityLiters.toStringAsFixed(0)} لتر',
                          context.locale.languageCode,
                        )),
                        TextButton(
                          onPressed: () => _showUpdateDialog(context, tank.id, tank.lastKnownLevel ?? 0),
                          child: const Text('تحديث المستوى'),
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

  void _showUpdateDialog(BuildContext context, String tankId, double currentLevel) {
    final controller = TextEditingController(text: currentLevel.toStringAsFixed(0));
    final cubit = context.read<StationsCubit>();
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('تحديث مستوى الخزان'),
        content: TextField(controller: controller, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'المستوى (لتر)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('إلغاء')),
          ElevatedButton(
            onPressed: () {
              final level = double.tryParse(controller.text);
              if (level != null) cubit.updateTankLevel(tankId, level);
              Navigator.pop(dialogContext);
            },
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? firstOrNull() => isEmpty ? null : first;
}
