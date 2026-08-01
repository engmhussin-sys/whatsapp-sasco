import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'app.dart';
import 'core/constants/supported_locales.dart';
import 'core/di/injection_container.dart';
import 'core/notifications/local_notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  await initDependencyInjection();

  // Local notifications work fully offline and need no external service —
  // safe to initialize unconditionally. Firebase push (see
  // core/notifications/push_notification_service.dart) is intentionally
  // NOT initialized here yet: no Firebase project is configured in this
  // Phase 1 delivery (see mobile/README.md for the exact steps to add one).
  // NOTE: Firebase.initializeApp() would also be called here once a
  // google-services.json / GoogleService-Info.plist exists.
  await sl<LocalNotificationService>().initialize();

  runApp(
    EasyLocalization(
      supportedLocales: SupportedLocales.activeLocales,
      path: 'assets/translations',
      fallbackLocale: const Locale('ar'),
      startLocale: const Locale('ar'),
      child: const App(),
    ),
  );
}
