import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Displays the real SASCO logo (assets/images/splash_logo.png) once the
/// company provides it. Until then — or if the asset is ever missing for
/// any reason — falls back to a clean branded icon+wordmark so the app
/// never crashes or shows a broken-image icon in front of the client.
class SascoLogo extends StatelessWidget {
  final double size;
  final bool showWordmark;

  const SascoLogo({super.key, this.size = 96, this.showWordmark = true});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          'assets/images/splash_logo.png',
          width: size,
          height: size,
          errorBuilder: (context, error, stackTrace) => _FallbackMark(size: size),
        ),
        if (showWordmark) ...[
          const SizedBox(height: 12),
          Text(
            'ساسكو',
            style: TextStyle(
              fontSize: size * 0.22,
              fontWeight: FontWeight.w800,
              color: AppColors.brandDark,
              letterSpacing: 1,
            ),
          ),
          Text(
            'SASCO',
            style: TextStyle(
              fontSize: size * 0.12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
              letterSpacing: 3,
            ),
          ),
        ],
      ],
    );
  }
}

class _FallbackMark extends StatelessWidget {
  final double size;
  const _FallbackMark({required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.brand,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: [
          BoxShadow(color: AppColors.brand.withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8)),
        ],
      ),
      child: Icon(Icons.local_gas_station_rounded, color: Colors.white, size: size * 0.55),
    );
  }
}
