import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/network/attendance_service.dart';
import '../../../../core/theme/app_colors.dart';

/// V3 rebrand animation directive: "مسح QR للحضور: خط ماسح يتحرك عمودياً
/// 2.4 ثانية تكراراً". Honest adaptation note: this backend's actual
/// attendance mechanism is GPS-based (see Sprint 11 —
/// backend/src/modules/attendance), not QR-code scanning — there is no
/// QR decode/validation on the server to scan FOR. The scanning-line
/// animation is kept (it's a genuinely nice "acquiring your location"
/// visual), just re-purposed for GPS acquisition instead of a camera
/// preview. Adding real QR-code check-in would need a scanner package
/// (e.g. mobile_scanner) AND a new backend QR-validation endpoint —
/// out of scope here; noted as real follow-up work, not silently
/// skipped.
class AttendancePage extends StatefulWidget {
  const AttendancePage({super.key});

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> with SingleTickerProviderStateMixin {
  late final AnimationController _scanController;
  final _service = sl<AttendanceService>();

  bool _loadingStatus = true;
  bool _checkedIn = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))..repeat();
    _loadStatus();
  }

  @override
  void dispose() {
    _scanController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final status = await _service.getMyStatus();
      if (mounted) setState(() => _checkedIn = status.checkedIn);
    } catch (e) {
      if (mounted) setState(() => _error = 'attendance.status_error'.tr());
    } finally {
      if (mounted) setState(() => _loadingStatus = false);
    }
  }

  Future<void> _toggle() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    double? lat;
    double? lng;
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission != LocationPermission.denied && permission != LocationPermission.deniedForever) {
        final position = await Geolocator.getCurrentPosition();
        lat = position.latitude;
        lng = position.longitude;
      }
    } catch (_) {
      // Location is best-effort — matches the existing SOS page's own
      // established pattern: never block the actual action on GPS
      // being available.
    }

    try {
      if (_checkedIn) {
        await _service.checkOut(latitude: lat, longitude: lng);
      } else {
        await _service.checkIn(latitude: lat, longitude: lng);
      }
      if (mounted) setState(() => _checkedIn = !_checkedIn);
    } catch (e) {
      if (mounted) setState(() => _error = 'attendance.action_error'.tr());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('attendance.title'.tr())),
      body: Center(
        child: _loadingStatus
            ? const CircularProgressIndicator()
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // ---- Scanning frame with the moving vertical line ----
                  ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 220,
                      height: 220,
                      color: AppColors.brandLight,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(
                            _checkedIn ? Icons.check_circle_outline_rounded : Icons.location_searching_rounded,
                            size: 72,
                            color: AppColors.brand,
                          ),
                          if (_submitting)
                            AnimatedBuilder(
                              animation: _scanController,
                              builder: (context, child) {
                                return Positioned(
                                  top: 220 * _scanController.value,
                                  child: Container(width: 220, height: 2, color: AppColors.brand.withOpacity(0.85)),
                                );
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    _checkedIn ? 'attendance.checked_in'.tr() : 'attendance.checked_out'.tr(),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(_error!, style: const TextStyle(color: AppColors.danger)),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _submitting ? null : _toggle,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _checkedIn ? AppColors.danger : AppColors.brand,
                      padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
                    ),
                    child: Text(
                      _submitting
                          ? 'attendance.processing'.tr()
                          : (_checkedIn ? 'attendance.check_out_button'.tr() : 'attendance.check_in_button'.tr()),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
