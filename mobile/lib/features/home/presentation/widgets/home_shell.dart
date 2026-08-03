import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';

/// T7 — persistent 4-tab bottom navigation (المحادثات · المهام · السلامة ·
/// حسابي), built on go_router's StatefulShellRoute.indexedStack so each
/// tab keeps its own navigation stack/scroll position when switching
/// away and back (the standard, correct pattern for this — NOT a plain
/// BottomNavigationBar + IndexedStack hand-rolled in a single page).
class HomeShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;
  const HomeShell({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => navigationShell.goBranch(
          index,
          // Tapping the ALREADY-active tab resets its stack to the
          // branch root instead of doing nothing — standard, expected
          // bottom-nav behavior (e.g. tapping "Messaging" while already
          // deep in a chat thread returns to the conversation list).
          initialLocation: index == navigationShell.currentIndex,
        ),
        items: [
          BottomNavigationBarItem(icon: const Icon(Icons.chat_bubble_outline_rounded), label: 'nav.messaging'.tr()),
          BottomNavigationBarItem(icon: const Icon(Icons.checklist_rounded), label: 'nav.tasks'.tr()),
          BottomNavigationBarItem(
            icon: const Icon(Icons.health_and_safety_outlined, color: AppColors.danger),
            label: 'safety.tab'.tr(),
          ),
          BottomNavigationBarItem(icon: const Icon(Icons.person_outline_rounded), label: 'profile.tab'.tr()),
        ],
      ),
    );
  }
}
