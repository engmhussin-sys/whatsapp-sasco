import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../bloc/auth_bloc.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    debugPrint('🔍 [TRACE] SplashPage.initState() — about to add AuthSessionCheckRequested');
    context.read<AuthBloc>().add(const AuthSessionCheckRequested());
    debugPrint('🔍 [TRACE] SplashPage.initState() — add() call returned (event dispatched)');
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AuthBloc, AuthState>(
      listener: (context, state) {
        debugPrint('🔍 [TRACE] SplashPage BlocListener fired — status=${state.status}');
        if (state.status == AuthStatus.authenticated) {
          context.go(RouteNames.home);
        } else if (state.status == AuthStatus.unauthenticated) {
          context.go(RouteNames.login);
        }
      },
      child: Scaffold(
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
      ),
    );
  }
}

/// White-on-green lockup — shows the real SASCO logo once
/// assets/images/splash_logo.png is added (see that folder's README);
/// falls back to a clean branded mark so the splash screen never shows
/// a broken-image icon in the meantime.
class _SplashMark extends StatelessWidget {
  const _SplashMark();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/images/splash_logo.png',
          width: 110,
          height: 110,
          errorBuilder: (context, error, stackTrace) => Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 24, offset: const Offset(0, 10))],
            ),
            child: Icon(Icons.local_gas_station_rounded, color: AppColors.brand, size: 58),
          ),
        ),
        const SizedBox(height: 18),
        const Text('ساسكو', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 1)),
        Text('SASCO', style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 4)),
      ],
    );
  }
}
