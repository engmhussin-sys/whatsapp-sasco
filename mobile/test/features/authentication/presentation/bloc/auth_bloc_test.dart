import 'package:bloc_test/bloc_test.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:workforce_connect_ai/core/error/failures.dart';
import 'package:workforce_connect_ai/core/usecase/usecase.dart';
import 'package:workforce_connect_ai/features/authentication/domain/entities/user_entity.dart';
import 'package:workforce_connect_ai/features/authentication/domain/usecases/get_current_user_usecase.dart';
import 'package:workforce_connect_ai/features/authentication/domain/usecases/login_usecase.dart';
import 'package:workforce_connect_ai/features/authentication/domain/usecases/logout_usecase.dart';
import 'package:workforce_connect_ai/features/authentication/domain/usecases/update_preferred_language_usecase.dart';
import 'package:workforce_connect_ai/features/authentication/presentation/bloc/auth_bloc.dart';

class MockLoginUseCase extends Mock implements LoginUseCase {}

class MockLogoutUseCase extends Mock implements LogoutUseCase {}

class MockGetCurrentUserUseCase extends Mock implements GetCurrentUserUseCase {}

class MockUpdatePreferredLanguageUseCase extends Mock implements UpdatePreferredLanguageUseCase {}

void main() {
  late MockLoginUseCase loginUseCase;
  late MockLogoutUseCase logoutUseCase;
  late MockGetCurrentUserUseCase getCurrentUserUseCase;
  late MockUpdatePreferredLanguageUseCase updatePreferredLanguageUseCase;
  late AuthBloc bloc;

  const tUser = UserEntity(
    id: 'user-1',
    email: 'worker@company.com',
    firstName: 'Sara',
    lastName: 'Ahmed',
    systemRole: SystemRole.worker,
    companyId: 'company-1',
    preferredLanguage: 'ar',
  );

  setUpAll(() {
    registerFallbackValue(const LoginParams(email: '', password: ''));
    registerFallbackValue(const NoParams());
  });

  setUp(() {
    loginUseCase = MockLoginUseCase();
    logoutUseCase = MockLogoutUseCase();
    getCurrentUserUseCase = MockGetCurrentUserUseCase();
    updatePreferredLanguageUseCase = MockUpdatePreferredLanguageUseCase();
    bloc = AuthBloc(
      loginUseCase: loginUseCase,
      logoutUseCase: logoutUseCase,
      getCurrentUserUseCase: getCurrentUserUseCase,
      updatePreferredLanguageUseCase: updatePreferredLanguageUseCase,
    );
  });

  tearDown(() => bloc.close());

  group('AuthSessionCheckRequested', () {
    blocTest<AuthBloc, AuthState>(
      'emits [authenticated] when a session already exists locally',
      setUp: () => when(() => getCurrentUserUseCase(any())).thenAnswer((_) async => const Right(tUser)),
      build: () => bloc,
      act: (b) => b.add(const AuthSessionCheckRequested()),
      expect: () => [
        const AuthState(status: AuthStatus.authenticated, user: tUser),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [unauthenticated] when no session is stored',
      setUp: () => when(() => getCurrentUserUseCase(any())).thenAnswer((_) async => const Right(null)),
      build: () => bloc,
      act: (b) => b.add(const AuthSessionCheckRequested()),
      expect: () => [
        const AuthState(status: AuthStatus.unauthenticated),
      ],
    );
  });

  group('AuthLoginRequested', () {
    blocTest<AuthBloc, AuthState>(
      'emits [submitting, authenticated] on successful login',
      setUp: () => when(() => loginUseCase(any())).thenAnswer((_) async => const Right(tUser)),
      build: () => bloc,
      act: (b) => b.add(const AuthLoginRequested(email: 'worker@company.com', password: 'CorrectPassw0rd!')),
      expect: () => [
        const AuthState(isSubmitting: true),
        const AuthState(status: AuthStatus.authenticated, user: tUser, isSubmitting: false),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'emits [submitting, error] on failed login without changing status to authenticated',
      setUp: () => when(() => loginUseCase(any()))
          .thenAnswer((_) async => const Left(UnauthorizedFailure('Invalid credentials'))),
      build: () => bloc,
      act: (b) => b.add(const AuthLoginRequested(email: 'worker@company.com', password: 'wrong')),
      expect: () => [
        const AuthState(isSubmitting: true),
        const AuthState(isSubmitting: false, errorMessage: 'Invalid credentials'),
      ],
    );
  });

  group('AuthLogoutRequested', () {
    blocTest<AuthBloc, AuthState>(
      'emits [unauthenticated] and calls the logout usecase',
      setUp: () => when(() => logoutUseCase(any())).thenAnswer((_) async => const Right(null)),
      build: () => bloc,
      act: (b) => b.add(const AuthLogoutRequested()),
      expect: () => [
        const AuthState(status: AuthStatus.unauthenticated),
      ],
      verify: (_) => verify(() => logoutUseCase(const NoParams())).called(1),
    );
  });

  group('AuthSessionExpired', () {
    blocTest<AuthBloc, AuthState>(
      'emits [unauthenticated] with a session-expired message (triggered by AuthInterceptor)',
      build: () => bloc,
      act: (b) => b.add(const AuthSessionExpired()),
      expect: () => [
        const AuthState(status: AuthStatus.unauthenticated, errorMessage: 'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا'),
      ],
    );
  });

  group('AuthLanguageChanged (T5)', () {
    const tUserBn = UserEntity(
      id: 'user-1',
      email: 'worker@company.com',
      firstName: 'Sara',
      lastName: 'Ahmed',
      systemRole: SystemRole.worker,
      companyId: 'company-1',
      preferredLanguage: 'bn',
    );

    blocTest<AuthBloc, AuthState>(
      'emits an updated user with the new preferredLanguage on success',
      setUp: () =>
          when(() => updatePreferredLanguageUseCase('bn')).thenAnswer((_) async => const Right(tUserBn)),
      build: () => bloc,
      seed: () => const AuthState(status: AuthStatus.authenticated, user: tUser),
      act: (b) => b.add(const AuthLanguageChanged('bn')),
      expect: () => [
        const AuthState(status: AuthStatus.authenticated, user: tUserBn),
      ],
    );

    blocTest<AuthBloc, AuthState>(
      'keeps the OLD user and surfaces an error message when the server call fails',
      setUp: () => when(() => updatePreferredLanguageUseCase('bn'))
          .thenAnswer((_) async => const Left(NetworkFailure())),
      build: () => bloc,
      seed: () => const AuthState(status: AuthStatus.authenticated, user: tUser),
      act: (b) => b.add(const AuthLanguageChanged('bn')),
      expect: () => [
        AuthState(status: AuthStatus.authenticated, user: tUser, errorMessage: const NetworkFailure().message),
      ],
    );
  });
}
