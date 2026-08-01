import 'package:flutter/material.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../domain/entities/fuel_request_entity.dart';
import '../../domain/usecases/fuel_requests_usecases.dart';

class FuelRequestDetailsPage extends StatefulWidget {
  final String companyId;
  final String fuelRequestId;
  const FuelRequestDetailsPage({super.key, required this.companyId, required this.fuelRequestId});

  @override
  State<FuelRequestDetailsPage> createState() => _FuelRequestDetailsPageState();
}

class _FuelRequestDetailsPageState extends State<FuelRequestDetailsPage> {
  FuelRequestEntity? _request;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final result = await sl<GetFuelRequestUseCase>()(
      GetFuelRequestParams(companyId: widget.companyId, id: widget.fuelRequestId),
    );
    if (!mounted) return;
    result.fold(
      (failure) => setState(() => _error = failure.message),
      (request) => setState(() => _request = request),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تفاصيل طلب الوقود')),
      body: _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : _request == null
              ? const LoadingView()
              : Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _row('المحطة', _request!.stationName ?? '—'),
                      _row('المستوى الحالي', '${_request!.currentLevel} لتر'),
                      _row('الكمية المطلوبة', '${_request!.requestedQuantity} لتر'),
                      if (_request!.notes != null) _row('ملاحظات', _request!.notes!),
                      _row('الحالة', _request!.status.name),
                      _row('تاريخ الطلب', _request!.createdAt.toString()),
                    ],
                  ),
                ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            SizedBox(width: 130, child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold))),
            Expanded(child: Text(value)),
          ],
        ),
      );
}
