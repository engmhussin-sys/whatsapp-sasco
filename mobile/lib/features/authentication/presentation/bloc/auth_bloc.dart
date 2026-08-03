import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/usecases/get_current_user_usecase.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import '../../domain/usecases/update_preferred_language_usecase.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final LoginUseCase _loginUseCase;
  final LogoutUseCase _logoutUseCase;
  final GetCurrentUserUseCase _getCurrentUserUseCase;
  final UpdatePreferredLanguageUseCase _updatePreferredLanguageUseCase;

  AuthBloc({
    required LoginUseCase loginUseCase,
    required LogoutUseCase logoutUseCase,
    required GetCurrentUserUseCase getCurrentUserUseCase,
    required UpdatePreferredLanguageUseCase updatePreferredLanguageUseCase,
  })  : _loginUseCase = loginUseCase,
        _logoutUseCase = logoutUseCase,
        _getCurrentUserUseCase = getCurrentUserUseCase,
        _updatePreferredLanguageUseCase = updatePreferredLanguageUseCase,
        super(const AuthState.initial()) {
    on<AuthSessionCheckRequested>(_onSessionCheckRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    on<AuthLogoutRequested>(_onLogoutRequested);
    on<AuthSessionExpired>(_onSessionExpired);
    on<AuthLanguageChanged>(_onLanguageChanged);
  }

  Future<void> _onSessionCheckRequested(AuthSessionCheckRequested event, Emitter<AuthState> emit) async {
    final result = await _getCurrentUserUseCase(const NoParams());
    result.fold(
      (failure) => emit(state.copyWith(status: AuthStatus.unauthenticated)),
      (user) => emit(user != null
          ? state.copyWith(status: AuthStatus.authenticated, user: user)
          : state.copyWith(status: AuthStatus.unauthenticated)),
    );
  }

  Future<void> _onLoginRequested(AuthLoginRequested event, Emitter<AuthState> emit) async {
    emit(state.copyWith(isSubmitting: true, clearError: true));
    final result = await _loginUseCase(
      LoginParams(email: event.email, password: event.password, companyId: event.companyId),
    );
    result.fold(
      (failure) => emit(state.copyWith(isSubmitting: false, errorMessage: _messageFor(failure))),
      (user) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
        isSubmitting: false,
        clearError: true,
      )),
    );
  }

  Future<void> _onLogoutRequested(AuthLogoutRequested event, Emitter<AuthState> emit) async {
    await _logoutUseCase(const NoParams());
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }

  Future<void> _onSessionExpired(AuthSessionExpired event, Emitter<AuthState> emit) async {
    emit(const AuthState(status: AuthStatus.unauthenticated, errorMessage: 'انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجددًا'));
  }

  Future<void> _onLanguageChanged(AuthLanguageChanged event, Emitter<AuthState> emit) async {
    final result = await _updatePreferredLanguageUseCase(event.languageCode);
    result.fold(
      (failure) => emit(state.copyWith(errorMessage: _messageFor(failure))),
      (user) => emit(state.copyWith(user: user, clearError: true)),
    );
  }

  String _messageFor(Failure failure) => failure.message;
}
