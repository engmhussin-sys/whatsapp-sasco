import 'package:flutter_local_notifications/flutter_local_notifications.dart';

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

    // BUG FIX (confirmed real cause: notifications silently never
    // appeared, no sound, no error anywhere): Android 13+ (API 33)
    // requires this permission at RUNTIME — declaring it in
    // AndroidManifest.xml alone does nothing on its own; the OS shows
    // the user a one-time "Allow notifications?" dialog only when the
    // app explicitly asks, exactly like camera/microphone. Without this
    // call, every plugin.show() below silently no-ops on Android 13+.
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    _initialized = true;
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
