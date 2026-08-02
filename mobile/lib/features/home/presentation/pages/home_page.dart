import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../authentication/presentation/bloc/auth_bloc.dart';

/// Home / Dashboard — Phase 1 scope: a role-aware navigation hub with
/// quick-access tiles to every feature, rather than a metrics dashboard
/// (the web Frontend already covers Super Admin / Company Admin
/// analytics dashboards in depth). Mobile's Home focuses on what a
/// Worker/Team Lead actually opens the app for day-to-day.
class HomePage extends StatelessWidget {
  final UserEntity user;
  const HomePage({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final tiles = <_HomeTile>[
      _HomeTile('المحادثات', Icons.chat_bubble_outline_rounded, AppColors.brand, () => context.push(RouteNames.conversations)),
      _HomeTile('المهام', Icons.checklist_rounded, const Color(0xFF2563EB), () => context.push(RouteNames.tasks)),
      _HomeTile('الموافقات', Icons.fact_check_outlined, const Color(0xFF7C3AED), () => context.push(RouteNames.approvals)),
      _HomeTile('الورديات', Icons.schedule_rounded, AppColors.accent, () => context.push(RouteNames.shift)),
      _HomeTile('طلبات الوقود', Icons.local_gas_station_rounded, AppColors.brandDark, () => context.push(RouteNames.fuelRequests)),
      _HomeTile('المحطات', Icons.store_outlined, const Color(0xFF0891B2), () => context.push(RouteNames.stations)),
    ];

    return Scaffold(
      backgroundColor: AppColors.surfaceLight,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.brand, AppColors.brandDark],
                  ),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('مرحبًا 👋', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(
                            user.firstName,
                            style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 2),
                          Text(_roleLabel(user.systemRole), style: const TextStyle(color: Colors.white70, fontSize: 12)),
                        ],
                      ),
                    ),
                    _CircleIconButton(
                      icon: Icons.person_outline_rounded,
                      onTap: () => context.push(RouteNames.profile),
                    ),
                    const SizedBox(width: 10),
                    _CircleIconButton(
                      icon: Icons.logout_rounded,
                      onTap: () => context.read<AuthBloc>().add(const AuthLogoutRequested()),
                    ),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                  childAspectRatio: 1.15,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _HomeTileCard(tile: tiles[index]),
                  childCount: tiles.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _roleLabel(SystemRole role) {
    switch (role) {
      case SystemRole.superAdmin:
        return 'مدير المنصة';
      case SystemRole.companyAdmin:
        return 'مدير الشركة';
      case SystemRole.teamLead:
        return 'قائد فريق';
      case SystemRole.worker:
        return 'عامل';
    }
  }
}

class _HomeTile {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  _HomeTile(this.label, this.icon, this.color, this.onTap);
}

class _HomeTileCard extends StatelessWidget {
  final _HomeTile tile;
  const _HomeTileCard({required this.tile});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: tile.onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.divider),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: tile.color.withOpacity(0.12), borderRadius: BorderRadius.circular(14)),
                child: Icon(tile.icon, color: tile.color, size: 24),
              ),
              Text(
                tile.label,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: AppColors.textPrimary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _CircleIconButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(9),
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.18), borderRadius: BorderRadius.circular(20)),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}
