/// Interface for push notifications (Firebase Cloud Messaging).
///
/// PHASE 1 SCOPE: interface + local-notification-only implementation.
/// No Firebase project is configured yet (no google-services.json /
/// GoogleService-Info.plist), so `FirebaseMessagingService` below is a
/// stub that returns null/no-ops rather than crashing — wiring a real
/// Firebase project is a configuration step, not a code change, once
/// Phase 2/3 needs remote push (e.g. AI-generated report ready,
/// approval assigned while the app is closed).
abstract class PushNotificationService {
  Future<void> initialize();
  Future<String?> getDeviceToken();
  Stream<Map<String, dynamic>> get onMessageReceived;
  Future<void> subscribeToTopic(String topic);
  Future<void> unsubscribeFromTopic(String topic);
}

class FirebaseMessagingServiceStub implements PushNotificationService {
  @override
  Future<void> initialize() async {
    // no-op until a Firebase project is wired up (see README for the steps)
  }

  @override
  Future<String?> getDeviceToken() async => null;

  @override
  Stream<Map<String, dynamic>> get onMessageReceived => const Stream.empty();

  @override
  Future<void> subscribeToTopic(String topic) async {}

  @override
  Future<void> unsubscribeFromTopic(String topic) async {}
}
