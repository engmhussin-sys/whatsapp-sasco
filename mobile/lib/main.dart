import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app.dart';
import 'core/constants/supported_locales.dart';
import 'core/di/injection_container.dart';
import 'core/notifications/local_notification_service.dart';
import 'core/theme/app_colors.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  // Branded status bar (Atheel Tech green background, light icons) — applied
  // globally before runApp so it's consistent from the very first frame,
  // including the native splash screen before Flutter takes over.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: AppColors.brandDark,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark,
    ),
  );

  await initDependencyInjection();

  // Local notifications work fully offline and need no external service —
  // safe to initialize unconditionally. Firebase push (see
  // core/notifications/push_notification_service.dart) is intentionally
  // NOT initialized here yet: no Firebase project is configured in this
  // Phase 1 delivery (see mobile/README.md for the exact steps to add one).
  // NOTE: Firebase.initializeApp() would also be called here once a
  // google-services.json / GoogleService-Info.plist exists.
  //
  // initialize() itself (plugin/channel setup) is safe to run here,
  // before runApp() — but the actual PERMISSION REQUEST is deliberately
  // deferred to after the first frame renders (see addPostFrameCallback
  // below): requesting it this early, before Flutter has attached to a
  // visible window, is a confirmed real cause of the dialog silently
  // failing to show on some Android versions/OEMs.
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

  WidgetsBinding.instance.addPostFrameCallback((_) {
    sl<LocalNotificationService>().requestPermission();
  });
}
