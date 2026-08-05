import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_colors.dart';
import '../bloc/auth_bloc.dart';

/// Triggers the session check and shows a loading UI — that's it.
/// Navigation AWAY from splash is handled EXCLUSIVELY by app_router.dart's
/// `redirect` callback (driven by `refreshListenable` on AuthBloc's
/// stream). This page deliberately does NOT call context.go() itself —
/// doing so previously raced against the router's own refreshListenable
/// reacting to the same stream emission, which caused SplashPage to be
/// rebuilt in an infinite loop instead of navigating away. Single source
/// of truth for navigation = no more race.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    context.read<AuthBloc>().add(const AuthSessionCheckRequested());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.brand, AppColors.brandDark],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const _SplashMark(),
              const SizedBox(height: 40),
              const SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white70),
              ),
              const SizedBox(height: 20),
              Text(
                'منصة تواصل وتشغيل فرق العمل',
                style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// White-on-green lockup — shows the Atheel Tech logo (V3 rebrand);
/// falls back to a clean branded mark so the splash screen never shows
/// a broken-image icon in the meantime.
class _SplashMark extends StatelessWidget {
  const _SplashMark();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 110,
          height: 110,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 24, offset: const Offset(0, 10))],
          ),
          child: Image.asset(
            'assets/images/atheel_logo.png',
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => Icon(Icons.eco_rounded, color: AppColors.brand, size: 58),
          ),
        ),
        const SizedBox(height: 18),
        const Text('أثيل تك', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1)),
        Text('ATHEEL TECH', style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 4)),
      ],
    );
  }
}
