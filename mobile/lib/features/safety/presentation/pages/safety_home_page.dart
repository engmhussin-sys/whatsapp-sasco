import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/network/sector_content_service.dart';
import '../../../authentication/domain/entities/user_entity.dart';

/// T8 screen 1/3 — PPE reminder grid + daily safety alert + entry points
/// to hazard reporting and SOS.
///
/// V3 rebrand (four-sector expansion): PPE items and the daily safety
/// alert are now SECTOR-AWARE — fetched from SectorContentService rather
/// than hardcoded fuel-station text. Per V3_DESIGN_UPDATE.md's own rule
/// ("لا تكتب القطاع في الكود — اقرأه من company.sector"), this screen's
/// STRUCTURE is unchanged; only its content source changed. Falls back
/// to the original generic 4-item PPE set (translation-key based, so
/// still correctly localized) while loading or if the fetch fails, so
/// the screen never shows empty/broken content.
class SafetyHomePage extends StatefulWidget {
  final UserEntity currentUser;
  const SafetyHomePage({super.key, required this.currentUser});

  @override
  State<SafetyHomePage> createState() => _SafetyHomePageState();
}

class _SafetyHomePageState extends State<SafetyHomePage> {
  static const _fallbackPpeItems = [
    (icon: Icons.construction, labelKey: 'safety.ppe_helmet'),
    (icon: Icons.safety_divider, labelKey: 'safety.ppe_vest'),
    (icon: Icons.back_hand_outlined, labelKey: 'safety.ppe_gloves'),
    (icon: Icons.hiking, labelKey: 'safety.ppe_boots'),
  ];

  SectorContent? _sectorContent;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSectorContent();
  }

  Future<void> _loadSectorContent() async {
    try {
      final content = await sl<SectorContentService>().getMySectorContent();
      if (mounted) setState(() => _sectorContent = content);
    } catch (_) {
      // Silent fallback to the generic PPE set below — a failed sector
      // fetch should never block the safety screen itself from being usable.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ppeTiles = _sectorContent != null
        ? _sectorContent!.ppeItems.map((item) => _PpeTile(emoji: item.icon, label: item.labelAr)).toList()
        : _fallbackPpeItems.map((item) => _PpeTile(fallbackIcon: item.icon, label: item.labelKey.tr())).toList();

    final dailyAlertText = _sectorContent?.dailySafetyAlertAr ?? 'safety.daily_alert'.tr();

    return Scaffold(
      appBar: AppBar(title: Text('safety.tab'.tr())),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ---- Daily safety alert banner (sector-aware) ----
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
                    dailyAlertText,
                    style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w700, height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
          Text('safety.ppe'.tr(), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),

          // ---- PPE grid (sector-aware, or generic fallback while
          //      loading / on error) ----
          if (_loading)
            const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
          else
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.15,
              children: ppeTiles,
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
  final IconData? fallbackIcon;
  final String? emoji;
  final String label;
  const _PpeTile({this.fallbackIcon, this.emoji, required this.label});

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
          if (emoji != null)
            Text(emoji!, style: const TextStyle(fontSize: 36))
          else
            Icon(fallbackIcon, size: 40, color: AppColors.brand),
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
