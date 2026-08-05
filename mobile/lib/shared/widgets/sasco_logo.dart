import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// V3 rebrand: displays the Atheel Tech logo (assets/images/atheel_logo.png).
/// Widget class NAME is deliberately kept as `SascoLogo` — per the rebrand
/// instructions — so every existing call site across the app (login,
/// splash, language picker) keeps working unchanged; only what it RENDERS
/// changed. Falls back to a clean branded mark if the asset is ever
/// missing, so the app never crashes or shows a broken-image icon.
class SascoLogo extends StatelessWidget {
  final double size;
  final bool showWordmark;

  const SascoLogo({super.key, this.size = 96, this.showWordmark = true});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // 13% internal padding + BoxFit.contain + white/transparent
        // background only — per V3_DESIGN_UPDATE.md's explicit rule
        // ("لا تضع خلفية خضراء خلفه").
        Container(
          width: size,
          height: size,
          padding: EdgeInsets.all(size * 0.13),
          decoration: const BoxDecoration(color: Colors.transparent),
          child: Image.asset(
            'assets/images/atheel_logo.png',
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => _FallbackMark(size: size * 0.74),
          ),
        ),
        if (showWordmark) ...[
          const SizedBox(height: 12),
          Text(
            'أثيل تك',
            style: TextStyle(
              fontSize: size * 0.22,
              fontWeight: FontWeight.w800,
              color: AppColors.brandDark,
              letterSpacing: 1,
            ),
          ),
          Text(
            'ATHEEL TECH',
            style: TextStyle(
              fontSize: size * 0.11,
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
      // Generic mark (no fuel-pump icon) — the app is no longer
      // fuel-station-specific as of the four-sector rebrand.
      child: Icon(Icons.eco_rounded, color: Colors.white, size: size * 0.55),
    );
  }
}
