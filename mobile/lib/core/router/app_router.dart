import 'package:go_router/go_router.dart';
import '../di/injection_container.dart';
import '../../features/authentication/presentation/bloc/auth_bloc.dart';
import '../../features/authentication/domain/entities/user_entity.dart';
import '../../features/authentication/presentation/pages/forgot_password_page.dart';
import '../../features/authentication/presentation/pages/login_page.dart';
import '../../features/authentication/presentation/pages/splash_page.dart';
import '../../features/chat/presentation/pages/chat_page.dart';
import '../../features/chat/presentation/pages/conversation_list_page.dart';
import '../../features/fuel_requests/presentation/pages/create_fuel_request_page.dart';
import '../../features/fuel_requests/presentation/pages/fuel_request_details_page.dart';
import '../../features/fuel_requests/presentation/pages/fuel_request_list_page.dart';
import '../../features/directory/presentation/pages/user_search_page.dart';
import '../../features/directory/presentation/pages/create_group_page.dart';
import '../../features/approvals/presentation/pages/approvals_list_page.dart';
import '../../features/home/presentation/pages/home_page.dart';
import '../../features/home/presentation/widgets/home_shell.dart';
import '../../features/profile/presentation/pages/language_settings_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/safety/presentation/pages/safety_home_page.dart';
import '../../features/safety/presentation/pages/hazard_report_page.dart';
import '../../features/safety/presentation/pages/sos_page.dart';
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
///
/// T7 — REBUILT around StatefulShellRoute.indexedStack: four persistent
/// bottom-nav branches (المحادثات · المهام · السلامة · حسابي), each
/// keeping its own navigation stack. Every ABSOLUTE path string in
/// route_names.dart is UNCHANGED — a branch's `routes:` list can hold
/// multiple top-level GoRoutes without them needing to be relative
/// children, so existing deep-links (e.g. RouteNames.chatPath(id)) keep
/// working exactly as before. Approvals/Shift/FuelRequests/Stations
/// move into the "حسابي" branch (reachable from HomePage's tiles,
/// itself now the branch's landing content) — none were deleted.
GoRouter buildAppRouter() {
  final authBloc = sl<AuthBloc>();

  return GoRouter(
    initialLocation: RouteNames.splash,
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    redirect: (context, state) {
      final authStatus = authBloc.state.status;
      final isAuthRoute = state.matchedLocation == RouteNames.login || state.matchedLocation == RouteNames.forgotPassword;
      final isSplash = state.matchedLocation == RouteNames.splash;

      // Session check still in flight (AuthBloc hasn't settled on
      // authenticated/unauthenticated yet) — stay put, SplashPage shows
      // a loading indicator. This is the ONLY place that decides
      // navigation; SplashPage itself does NOT call context.go() —
      // doing so from both here (via refreshListenable) AND a
      // BlocListener reacting to the same AuthBloc stream caused a
      // real, confirmed race that bounced back to /splash indefinitely.
      if (authStatus == AuthStatus.unknown) return null;

      if (authStatus == AuthStatus.unauthenticated) {
        return isAuthRoute ? null : RouteNames.login;
      }
      if (authStatus == AuthStatus.authenticated) {
        // Landing tab is now "المحادثات" (first bottom-nav branch)
        // rather than the old tile-grid HomePage — HomePage still
        // exists and is still reachable (see the "حسابي" branch below).
        return (isAuthRoute || isSplash) ? RouteNames.conversations : null;
      }
      return null;
    },
    routes: [
      GoRoute(path: RouteNames.splash, builder: (context, state) => const SplashPage()),
      GoRoute(path: RouteNames.login, builder: (context, state) => const LoginPage()),
      GoRoute(path: RouteNames.forgotPassword, builder: (context, state) => const ForgotPasswordPage()),

      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => HomeShell(navigationShell: navigationShell),
        branches: [
          // ---- Branch 0: المحادثات ----
          StatefulShellBranch(routes: [
            GoRoute(
              path: RouteNames.conversations,
              builder: (context, state) => ConversationListPage(currentUser: authBloc.state.user!),
            ),
            GoRoute(
              path: RouteNames.newChat,
              builder: (context, state) => UserSearchPage(currentUser: authBloc.state.user!),
            ),
            GoRoute(
              path: RouteNames.newGroup,
              // Group creation is restricted to admins/leads — see
              // CreateGroupPage's doc comment. Redirect defends the
              // route itself (not just hiding the button) in case
              // someone navigates here directly.
              redirect: (context, state) {
                final role = authBloc.state.user?.systemRole;
                final allowed = role == SystemRole.companyAdmin || role == SystemRole.teamLead || role == SystemRole.superAdmin;
                return allowed ? null : RouteNames.conversations;
              },
              builder: (context, state) => CreateGroupPage(currentUser: authBloc.state.user!),
            ),
            GoRoute(
              path: RouteNames.chat,
              builder: (context, state) => ChatPage(
                conversationId: state.pathParameters['conversationId']!,
                currentUser: authBloc.state.user!,
              ),
            ),
          ]),

          // ---- Branch 1: المهام ----
          StatefulShellBranch(routes: [
            GoRoute(path: RouteNames.tasks, builder: (context, state) => TaskListPage(currentUser: authBloc.state.user!)),
            GoRoute(
              path: RouteNames.taskDetails,
              builder: (context, state) => TaskDetailsPage(
                companyId: authBloc.state.user!.companyId!,
                taskId: state.pathParameters['taskId']!,
              ),
            ),
          ]),

          // ---- Branch 2: السلامة (T8) ----
          StatefulShellBranch(routes: [
            GoRoute(path: RouteNames.safety, builder: (context, state) => SafetyHomePage(currentUser: authBloc.state.user!)),
            GoRoute(
              path: RouteNames.safetyHazardReport,
              builder: (context, state) => HazardReportPage(currentUser: authBloc.state.user!),
            ),
            GoRoute(path: RouteNames.safetySos, builder: (context, state) => SosPage(currentUser: authBloc.state.user!)),
          ]),

          // ---- Branch 3: حسابي (Approvals/Shift/FuelRequests/Stations moved here — none deleted) ----
          StatefulShellBranch(routes: [
            GoRoute(path: RouteNames.home, builder: (context, state) => HomePage(user: authBloc.state.user!)),
            GoRoute(path: RouteNames.profile, builder: (context, state) => ProfilePage(user: authBloc.state.user!)),
            GoRoute(path: RouteNames.languageSettings, builder: (context, state) => const LanguageSettingsPage()),

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
          ]),
        ],
      ),
    ],
  );
}
