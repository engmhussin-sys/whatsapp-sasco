import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/di/injection_container.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../stations/domain/entities/station_entity.dart';
import '../../../stations/presentation/bloc/stations_cubit.dart';
import '../bloc/fuel_requests_cubit.dart';

class CreateFuelRequestPage extends StatefulWidget {
  final UserEntity currentUser;
  const CreateFuelRequestPage({super.key, required this.currentUser});

  @override
  State<CreateFuelRequestPage> createState() => _CreateFuelRequestPageState();
}

class _CreateFuelRequestPageState extends State<CreateFuelRequestPage> {
  StationEntity? _selectedStation;
  String? _selectedTankId;
  final _currentLevelController = TextEditingController();
  final _requestedQuantityController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(create: (_) => sl<StationsCubit>(param1: widget.currentUser.companyId)..load()),
        BlocProvider(create: (_) => sl<FuelRequestsCubit>(param1: widget.currentUser.companyId)),
      ],
      child: Scaffold(
        appBar: AppBar(title: const Text('طلب تغذية وقود جديد')),
        body: BlocConsumer<FuelRequestsCubit, FuelRequestsState>(
          listener: (context, state) {
            if (state.errorMessage != null && !state.isCreating) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }
          },
          builder: (context, fuelState) {
            return BlocBuilder<StationsCubit, StationsState>(
              builder: (context, stationsState) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      DropdownButtonFormField<StationEntity>(
                        decoration: const InputDecoration(labelText: 'المحطة'),
                        value: _selectedStation,
                        items: stationsState.stations
                            .map((s) => DropdownMenuItem(value: s, child: Text(s.name)))
                            .toList(),
                        onChanged: (s) => setState(() {
                          _selectedStation = s;
                          _selectedTankId = null;
                        }),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        decoration: const InputDecoration(labelText: 'الخزان'),
                        value: _selectedTankId,
                        items: (_selectedStation?.tanks ?? [])
                            .map((t) => DropdownMenuItem(value: t.id, child: Text('${t.code} — ${t.fuelType}')))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedTankId = v),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _currentLevelController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'المستوى الحالي (لتر)'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _requestedQuantityController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'الكمية المطلوبة (لتر)'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _notesController,
                        decoration: const InputDecoration(labelText: 'ملاحظات (اختياري)'),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: fuelState.isCreating ? null : _submit,
                        child: fuelState.isCreating
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('إرسال الطلب'),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_selectedStation == null || _selectedTankId == null) return;
    final currentLevel = double.tryParse(_currentLevelController.text) ?? 0;
    final requestedQuantity = double.tryParse(_requestedQuantityController.text) ?? 0;

    final success = await context.read<FuelRequestsCubit>().create(
          stationId: _selectedStation!.id,
          tankId: _selectedTankId!,
          currentLevel: currentLevel,
          requestedQuantity: requestedQuantity,
          notes: _notesController.text.isEmpty ? null : _notesController.text,
        );

    if (success && mounted) Navigator.of(context).pop();
  }
}
