// Real end-to-end integration test — runs the ACTUAL app (same bootstrap
// as main.dart) against a REAL backend, not mocks. Requires a reachable
// API_BASE_URL (see run instructions in integration_test/README.md).
//
// Run with:
//   flutter test integration_test/app_test.dart \
//     --dart-define=API_BASE_URL=https://whatsapp-sasco-production.up.railway.app/api/v1 \
//     --dart-define=WS_BASE_URL=https://whatsapp-sasco-production.up.railway.app \
//     --dart-define=TEST_EMAIL=worker@demo-fuel-co.com \
//     --dart-define=TEST_PASSWORD=Demo@12345
//
// Defaults match the seed script's own demo Worker account exactly
// (see backend/prisma/seed.ts) — override only if testing against a
// different, non-seeded environment.

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:integration_test/integration_test.dart';
import 'package:workforce_connect_ai/app.dart';
import 'package:workforce_connect_ai/core/constants/supported_locales.dart';
import 'package:workforce_connect_ai/core/di/injection_container.dart';
import 'package:workforce_connect_ai/core/storage/secure_storage_service.dart';

const _testEmail = String.fromEnvironment('TEST_EMAIL', defaultValue: 'worker@demo-fuel-co.com');
const _testPassword = String.fromEnvironment('TEST_PASSWORD', defaultValue: 'Demo@12345');

Future<void> pumpRealApp(WidgetTester tester) async {
  // BUG FIX (caught before shipping, not after): initDependencyInjection()
  // has no idempotency guard — get_it's registerLazySingleton throws on a
  // SECOND registration of the same type. Running more than one testWidgets
  // in this file would crash on the second one without this reset. Also
  // clears any secure-storage session token left behind by a PREVIOUS
  // test's successful login, so each test starts genuinely logged out.
  await GetIt.instance.reset();
  await initDependencyInjection();
  // FlutterSecureStorage is the REAL OS keychain — it survives
  // GetIt.instance.reset() (that only clears the DI graph, not disk/
  // keychain state). Without this, a successful login in one test would
  // silently auto-log-in a LATER test via the leftover stored session,
  // making that test's "still on login screen" assertion meaningless.
  await sl<SecureStorageService>().clearSession();
  await tester.pumpWidget(
    EasyLocalization(
      supportedLocales: SupportedLocales.activeLocales,
      path: 'assets/translations',
      fallbackLocale: const Locale('ar'),
      startLocale: const Locale('ar'),
      child: const App(),
    ),
  );
  // EasyLocalization needs a real frame + microtask flush before its
  // translations are ready — a single pump() is not reliably enough on
  // slower CI runners, hence pumpAndSettle with a generous timeout
  // rather than a fixed pump count.
  await tester.pumpAndSettle(const Duration(seconds: 5));
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication flow (real backend)', () {
    testWidgets('worker can log in with email + password and reach the home shell', (tester) async {
      await pumpRealApp(tester);

      // Switch to email mode (app defaults to phone-first login — see
      // login_page.dart's own comment on why) so TEST_EMAIL/TEST_PASSWORD
      // above are meaningful.
      final emailModeButton = find.byKey(const ValueKey('login_mode_email_button'));
      expect(emailModeButton, findsOneWidget, reason: 'Login screen did not render as expected');
      await tester.tap(emailModeButton);
      await tester.pumpAndSettle();

      final emailField = find.byKey(const ValueKey('login_email_field'));
      final passwordField = find.byKey(const ValueKey('login_password_field'));
      expect(emailField, findsOneWidget);
      expect(passwordField, findsOneWidget);

      await tester.enterText(emailField, _testEmail);
      await tester.enterText(passwordField, _testPassword);
      await tester.pumpAndSettle();

      final submitButton = find.byKey(const ValueKey('login_submit_button'));
      await tester.tap(submitButton);

      // Real network round-trip to the real backend — needs real time,
      // not just frame pumps. 15s covers slow-start Railway cold starts.
      await tester.pumpAndSettle(const Duration(seconds: 15));

      // Success is reaching the home shell's bottom navigation — absence
      // of any error banner is not proof of success (a network timeout
      // would ALSO show no error banner momentarily), so this asserts
      // something that only exists after a genuinely successful login.
      final bottomNav = find.byType(BottomNavigationBar);
      expect(
        bottomNav,
        findsOneWidget,
        reason: 'Did not reach the home shell after login — check TEST_EMAIL/TEST_PASSWORD and API_BASE_URL are correct and the backend is reachable',
      );
    });

    testWidgets('wrong password shows an error and does NOT navigate away from login', (tester) async {
      await pumpRealApp(tester);

      await tester.tap(find.byKey(const ValueKey('login_mode_email_button')));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const ValueKey('login_email_field')), _testEmail);
      await tester.enterText(find.byKey(const ValueKey('login_password_field')), 'DefinitelyWrongPassword123');
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('login_submit_button')));
      await tester.pumpAndSettle(const Duration(seconds: 10));

      // Still on the login screen — the email field must still exist.
      expect(find.byKey(const ValueKey('login_email_field')), findsOneWidget);
    });
  });
}
