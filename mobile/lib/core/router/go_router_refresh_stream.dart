import 'dart:async';
import 'package:flutter/foundation.dart';

/// Standard go_router idiom: converts any Stream (here, AuthBloc's state
/// stream) into a ChangeNotifier so GoRouter's `refreshListenable` can
/// re-evaluate `redirect` whenever auth status changes (e.g. login,
/// logout, or AuthSessionExpired firing from the network layer).
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
