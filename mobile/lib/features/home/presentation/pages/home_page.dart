import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/router/route_names.dart';
import '../../../authentication/domain/entities/user_entity.dart';
import '../../../authentication/presentation/bloc/auth_bloc.dart';

/// Home / Dashboard — Phase 1 scope: a role-aware navigation hub with
/// quick-access tiles to every feature, rather than a metrics dashboard
/// (the web Frontend already covers Super Admin / Company Admin
/// analytics dashboards in depth — see frontend/src/app/*/dashboard).
/// Mobile's Home focuses on what a Worker/Team Lead actually opens the
/// app for day-to-day: messaging, today's tasks, pending approvals, and
/// shift/fuel actions.
class HomePage extends StatelessWidget {
  final UserEntity user;
  const HomePage({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final tiles = <_HomeTile>[
      _HomeTile('المحادثات', Icons.chat_bubble_outline, () => context.push(RouteNames.conversations)),
      _HomeTile('المهام', Icons.checklist_rounded, () => context.push(RouteNames.tasks)),
      _HomeTile('الموافقات', Icons.fact_check_outlined, () => context.push(RouteNames.approvals)),
      _HomeTile('الورديات', Icons.schedule, () => context.push(RouteNames.shift)),
      _HomeTile('طلبات الوقود', Icons.local_gas_station_outlined, () => context.push(RouteNames.fuelRequests)),
      _HomeTile('المحطات', Icons.store_outlined, () => context.push(RouteNames.stations)),
      _HomeTile('الملف الشخصي', Icons.person_outline, () => context.push(RouteNames.profile)),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text('مرحبًا، ${user.firstName}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthBloc>().add(const AuthLogoutRequested()),
          ),
        ],
      ),
      body: GridView.count(
        padding: const EdgeInsets.all(16),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        children: tiles
            .map((t) => Card(
                  child: InkWell(
                    onTap: t.onTap,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(t.icon, size: 36, color: const Color(0xFF2563EB)),
                        const SizedBox(height: 8),
                        Text(t.label, textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _HomeTile {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  _HomeTile(this.label, this.icon, this.onTap);
}
