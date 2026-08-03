import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../authentication/domain/entities/user_entity.dart';

/// T8 screen 1/3 — PPE reminder grid + daily safety alert + entry points
/// to hazard reporting and SOS. No real photos exist yet (design handoff
/// used text-only placeholders) — every PPE tile uses a Material icon
/// with an `Image.network(..., errorBuilder: ...)` slot underneath so a
/// real photo can be dropped in later per-station with ZERO code
/// changes, exactly as specified.
class SafetyHomePage extends StatelessWidget {
  final UserEntity currentUser;
  const SafetyHomePage({super.key, required this.currentUser});

  static const _ppeItems = [
    (icon: Icons.construction, labelKey: 'safety.ppe_helmet', imageUrl: null),
    (icon: Icons.safety_divider, labelKey: 'safety.ppe_vest', imageUrl: null),
    (icon: Icons.back_hand_outlined, labelKey: 'safety.ppe_gloves', imageUrl: null),
    (icon: Icons.hiking, labelKey: 'safety.ppe_boots', imageUrl: null),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('safety.tab'.tr())),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ---- Daily safety alert banner ----
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppColors.brand, AppColors.brandDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                const Icon(Icons.shield_outlined, color: Colors.white, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'safety.daily_alert'.tr(),
                    style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700, height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          Text('safety.ppe'.tr(), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),

          // ---- PPE grid ----
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.15,
            children: _ppeItems
                .map((item) => _PpeTile(icon: item.icon, label: item.labelKey.tr(), imageUrl: item.imageUrl))
                .toList(),
          ),

          const SizedBox(height: 24),

          // ---- Report hazard ----
          _ActionTile(
            icon: Icons.report_problem_outlined,
            color: AppColors.accent,
            title: 'safety.report_hazard'.tr(),
            onTap: () => context.push(RouteNames.safetyHazardReport),
          ),
          const SizedBox(height: 12),

          // ---- SOS ----
          _ActionTile(
            icon: Icons.sos_rounded,
            color: AppColors.danger,
            title: 'safety.sos'.tr(),
            onTap: () => context.push(RouteNames.safetySos),
          ),
        ],
      ),
    );
  }
}

class _PpeTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? imageUrl;
  const _PpeTile({required this.icon, required this.label, this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.divider),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Real-photo slot: falls back to the Material icon whenever no
          // image URL is set yet, or the network image fails to load.
          if (imageUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                imageUrl!,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Icon(icon, size: 40, color: AppColors.brand),
              ),
            )
          else
            Icon(icon, size: 40, color: AppColors.brand),
          const SizedBox(height: 8),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final VoidCallback onTap;
  const _ActionTile({required this.icon, required this.color, required this.title, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(16)),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: color, size: 26),
              ),
              const SizedBox(width: 14),
              Expanded(child: Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
              const Icon(Icons.chevron_left_rounded, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
