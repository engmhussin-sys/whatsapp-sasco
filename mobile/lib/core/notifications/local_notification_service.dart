import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

/// In-app / OS-level local notifications (e.g. "new message" while the
/// app is backgrounded but not killed). Unlike push, this works fully
/// offline and needs no external service — implemented for real, not
/// stubbed.
class LocalNotificationService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );
    _initialized = true;
  }

  /// BUG FIX (confirmed real cause — could not get a clear answer on
  /// whether the permission dialog even appears, which itself was the
  /// symptom): this used to request the permission INSIDE initialize(),
  /// which main.dart calls BEFORE runApp(). At that point Flutter's
  /// engine has not yet attached to a visible, RESUMED Activity — no
  /// window exists to host a system permission dialog on. Depending on
  /// the Android version/OEM, that request can silently fail, get
  /// auto-denied, or render behind the splash screen invisibly, with no
  /// error surfaced anywhere — exactly the "I can't tell if it ever
  /// shows" symptom. This is now a SEPARATE method, called only after
  /// the first frame has actually rendered (see main.dart's
  /// addPostFrameCallback), once a real window unquestionably exists.
  Future<void> requestPermission() async {
    await Permission.notification.request();
  }

  /// Whether notifications are currently allowed — useful for a
  /// settings-page banner prompting the person to enable them if they
  /// were denied (Android will not re-show its OWN system dialog after
  /// a denial; only Settings can grant it back from there).
  Future<bool> isPermissionGranted() async {
    return Permission.notification.isGranted;
  }

  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'wfc_default_channel',
      'WorkForce Connect',
      channelDescription: 'General app notifications',
      importance: Importance.high,
      priority: Priority.high,
    );
    const details = NotificationDetails(android: androidDetails, iOS: DarwinNotificationDetails());
    await _plugin.show(id, title, body, details, payload: payload);
  }
}
