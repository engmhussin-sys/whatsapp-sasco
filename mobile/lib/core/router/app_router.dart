import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../di/injection_container.dart';
import '../../features/authentication/presentation/bloc/auth_bloc.dart';
import '../../features/authentication/presentation/pages/forgot_password_page.dart';
import '../../features/authentication/presentation/pages/login_page.dart';
import '../../features/authentication/presentation/pages/splash_page.dart';
import '../../features/chat/presentation/pages/chat_page.dart';
import '../../features/chat/presentation/pages/conversation_list_page.dart';
import '../../features/fuel_requests/presentation/pages/create_fuel_request_page.dart';
import '../../features/fuel_requests/presentation/pages/fuel_request_details_page.dart';
import '../../features/fuel_requests/presentation/pages/fuel_request_list_page.dart';
import '../../features/approvals/presentation/pages/approvals_list_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/profile/presentation/pages/language_settings_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/shift/presentation/pages/shift_page.dart';
import '../../features/stations/presentation/pages/station_pages.dart';
import '../../features/tasks/presentation/pages/task_details_page.dart';
import '../../features/tasks/presentation/pages/task_list_page.dart';
import 'go_router_refresh_stream.dart';
import 'route_names.dart';

/// Every authenticated route reads its `currentUser`/`companyId` straight
/// from `sl<AuthBloc>().state` rather than threading it through go_router's
/// `extra` param — safe here because `redirect` below guarantees these
/// routes are never reached while unauthenticated (state.user is always
/// non-null by the time a builder for one of them runs).
GoRouter buildAppRouter() {
  final authBloc = sl<AuthBloc>();

  return GoRouter(
    initialLocation: RouteNames.splash,
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    redirect: (context, state) {
      final authStatus = authBloc.state.status;
      final isSplash = state.matchedLocation == RouteNames.splash;
      final isAuthRoute = state.matchedLocation == RouteNames.login || state.matchedLocation == RouteNames.forgotPassword;

      if (isSplash) return null; // Splash itself decides where to go next
      if (authStatus == AuthStatus.unauthenticated && !isAuthRoute) return RouteNames.login;
      if (authStatus == AuthStatus.authenticated && isAuthRoute) return RouteNames.home;
      return null;
    },
    routes: [
      GoRoute(path: RouteNames.splash, builder: (context, state) => const SplashPage()),
      GoRoute(path: RouteNames.login, builder: (context, state) => const LoginPage()),
      GoRoute(path: RouteNames.forgotPassword, builder: (context, state) => const ForgotPasswordPage()),

      GoRoute(path: RouteNames.home, builder: (context, state) => HomePage(user: authBloc.state.user!)),

      GoRoute(
        path: RouteNames.conversations,
        builder: (context, state) => ConversationListPage(currentUser: authBloc.state.user!),
      ),
      GoRoute(
        path: RouteNames.chat,
        builder: (context, state) => ChatPage(
          conversationId: state.pathParameters['conversationId']!,
          currentUser: authBloc.state.user!,
        ),
      ),

      GoRoute(path: RouteNames.tasks, builder: (context, state) => TaskListPage(currentUser: authBloc.state.user!)),
      GoRoute(
        path: RouteNames.taskDetails,
        builder: (context, state) => TaskDetailsPage(
          companyId: authBloc.state.user!.companyId!,
          taskId: state.pathParameters['taskId']!,
        ),
      ),

      GoRoute(path: RouteNames.approvals, builder: (context, state) => ApprovalsListPage(currentUser: authBloc.state.user!)),

      GoRoute(path: RouteNames.shift, builder: (context, state) => ShiftPage(currentUser: authBloc.state.user!)),

      GoRoute(
        path: RouteNames.fuelRequests,
        builder: (context, state) => FuelRequestListPage(currentUser: authBloc.state.user!),
      ),
      GoRoute(
        path: RouteNames.createFuelRequest,
        builder: (context, state) => CreateFuelRequestPage(currentUser: authBloc.state.user!),
      ),
      GoRoute(
        path: RouteNames.fuelRequestDetails,
        builder: (context, state) => FuelRequestDetailsPage(
          companyId: authBloc.state.user!.companyId!,
          fuelRequestId: state.pathParameters['fuelRequestId']!,
        ),
      ),

      GoRoute(
        path: RouteNames.stations,
        builder: (context, state) => StationListPage(companyId: authBloc.state.user!.companyId!),
      ),
      GoRoute(
        path: RouteNames.stationTanks,
        builder: (context, state) => TankLevelsPage(
          companyId: authBloc.state.user!.companyId!,
          stationId: state.pathParameters['stationId']!,
        ),
      ),

      GoRoute(path: RouteNames.profile, builder: (context, state) => ProfilePage(user: authBloc.state.user!)),
      GoRoute(path: RouteNames.languageSettings, builder: (context, state) => const LanguageSettingsPage()),
    ],
  );
}
