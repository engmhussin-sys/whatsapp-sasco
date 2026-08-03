import 'dart:async';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/notifications/local_notification_service.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../chat/domain/repositories/chat_repository.dart';

/// T7 — persistent 4-tab bottom navigation (المحادثات · المهام · السلامة ·
/// حسابي), built on go_router's StatefulShellRoute.indexedStack so each
/// tab keeps its own navigation stack/scroll position when switching
/// away and back (the standard, correct pattern for this — NOT a plain
/// BottomNavigationBar + IndexedStack hand-rolled in a single page).
///
/// CRITICAL FIX: this is also where the WebSocket connection is now
/// actually established. Previously `ChatRepository.connectRealtime()`
/// existed but was NEVER called from anywhere in the app — meaning the
/// underlying socket was never connected, so `joinConversation` calls
/// from ChatBloc silently emitted to a null socket, and real-time
/// delivery / notifications never actually worked. HomeShell is the one
/// widget that's mounted for the ENTIRE authenticated session (per
/// app_router.dart's StatefulShellRoute), making it the correct single
/// place to own the connection's lifetime — connect once here, listen
/// for `message:notification` globally (works even while viewing a
/// completely different tab/conversation), disconnect on logout.
class HomeShell extends StatefulWidget {
  final StatefulNavigationShell navigationShell;
  const HomeShell({super.key, required this.navigationShell});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late final ChatRepository _chatRepository;
  StreamSubscription<Map<String, dynamic>>? _notificationSub;

  @override
  void initState() {
    super.initState();
    _chatRepository = sl<ChatRepository>();
    _connectAndListen();
  }

  Future<void> _connectAndListen() async {
    await _chatRepository.connectRealtime();
    _notificationSub = _chatRepository.onNotification.listen((data) {
      final senderName = data['senderName'] as String? ?? '';
      final preview = data['preview'] as String? ?? 'notifications.new_message'.tr();
      sl<LocalNotificationService>().showNotification(
        id: (data['messageId'] as String?)?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
        title: senderName.isEmpty ? 'notifications.new_message'.tr() : senderName,
        body: preview,
        payload: data['conversationId'] as String?,
      );
    });
  }

  @override
  void dispose() {
    _notificationSub?.cancel();
    _chatRepository.disconnectRealtime();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: widget.navigationShell.currentIndex,
        onTap: (index) => widget.navigationShell.goBranch(
          index,
          // Tapping the ALREADY-active tab resets its stack to the
          // branch root instead of doing nothing — standard, expected
          // bottom-nav behavior (e.g. tapping "Messaging" while already
          // deep in a chat thread returns to the conversation list).
          initialLocation: index == widget.navigationShell.currentIndex,
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
