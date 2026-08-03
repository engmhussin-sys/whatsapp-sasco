import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../cubit/safety_cubit.dart';

/// T8 screen 3/3 — SOS: a 170dp circular button with a pulsing ring
/// (the ONE deliberate exception to "no shadow on cards" — an emergency
/// action is allowed a shadow/glow per the design handoff), held for 3
/// seconds to confirm (prevents accidental triggers), then sends the
/// worker's current location.
class SosPage extends StatefulWidget {
  final UserEntity currentUser;
  const SosPage({super.key, required this.currentUser});

  @override
  State<SosPage> createState() => _SosPageState();
}

class _SosPageState extends State<SosPage> with SingleTickerProviderStateMixin {
  static const _holdDuration = Duration(seconds: 3);
  late final AnimationController _pulseController;
  late final SafetyCubit _cubit;

  double _holdProgress = 0;
  bool _isHolding = false;
  DateTime? _holdStartedAt;

  @override
  void initState() {
    super.initState();
    _cubit = sl<SafetyCubit>(param1: widget.currentUser.companyId);
    _pulseController = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _onHoldStart() {
    setState(() {
      _isHolding = true;
      _holdStartedAt = DateTime.now();
    });
    _tickHold();
  }

  void _tickHold() async {
    while (_isHolding && mounted) {
      await Future.delayed(const Duration(milliseconds: 50));
      if (!_isHolding || _holdStartedAt == null) return;
      final elapsed = DateTime.now().difference(_holdStartedAt!);
      final progress = (elapsed.inMilliseconds / _holdDuration.inMilliseconds).clamp(0.0, 1.0);
      if (!mounted) return;
      setState(() => _holdProgress = progress);
      if (progress >= 1.0) {
        _isHolding = false;
        _sendSos();
        return;
      }
    }
  }

  void _onHoldEnd() {
    setState(() {
      _isHolding = false;
      _holdProgress = 0;
    });
  }

  Future<void> _sendSos() async {
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
      // Location is best-effort — an SOS with no coordinates is still
      // FAR better than no SOS at all; never block sending on this.
    }
    _cubit.raiseSos(latitude: lat, longitude: lng);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Scaffold(
        appBar: AppBar(title: Text('safety.sos'.tr())),
        body: BlocConsumer<SafetyCubit, SafetyState>(
          listener: (context, state) {
            if (state.sosStatus == SafetySubmitStatus.success) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('safety.sos_sent'.tr()), backgroundColor: AppColors.danger));
            } else if (state.sosStatus == SafetySubmitStatus.failure && state.errorMessage != null) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }
          },
          builder: (context, state) {
            final sent = state.sosStatus == SafetySubmitStatus.success;
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    sent ? 'safety.sos_sent'.tr() : 'safety.sos_hold'.tr(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 40),
                  GestureDetector(
                    onLongPressStart: sent ? null : (_) => _onHoldStart(),
                    onLongPressEnd: sent ? null : (_) => _onHoldEnd(),
                    onLongPressCancel: sent ? null : _onHoldEnd,
                    child: AnimatedBuilder(
                      animation: _pulseController,
                      builder: (context, child) {
                        final pulseScale = 1.0 + (_pulseController.value * 0.12);
                        return Stack(
                          alignment: Alignment.center,
                          children: [
                            if (!sent)
                              Transform.scale(
                                scale: pulseScale,
                                child: Container(
                                  width: 170,
                                  height: 170,
                                  decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.danger.withValues(alpha: 0.15)),
                                ),
                              ),
                            // Hold-progress ring
                            SizedBox(
                              width: 190,
                              height: 190,
                              child: CircularProgressIndicator(
                                value: _isHolding ? _holdProgress : 0,
                                strokeWidth: 5,
                                backgroundColor: Colors.transparent,
                                valueColor: const AlwaysStoppedAnimation(AppColors.accent),
                              ),
                            ),
                            Container(
                              width: 170,
                              height: 170,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: sent ? AppColors.textSecondary : AppColors.danger,
                                boxShadow: sent
                                    ? []
                                    : [BoxShadow(color: AppColors.danger.withValues(alpha: 0.4), blurRadius: 24, spreadRadius: 4)],
                              ),
                              child: Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(sent ? Icons.check_rounded : Icons.sos_rounded, color: Colors.white, size: 48),
                                    const SizedBox(height: 4),
                                    const Text('SOS', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
