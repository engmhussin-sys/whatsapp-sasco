part of 'auth_bloc.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();
  @override
  List<Object?> get props => [];
}

/// Dispatched once at app startup (Splash) to check for a persisted session.
class AuthSessionCheckRequested extends AuthEvent {
  const AuthSessionCheckRequested();
}

class AuthLoginRequested extends AuthEvent {
  final String email;
  final String password;
  final String? companyId;
  const AuthLoginRequested({required this.email, required this.password, this.companyId});

  @override
  List<Object?> get props => [email, password, companyId];
}

class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

/// Dispatched by AuthInterceptor (via a callback wired at DI time) when a
/// refresh attempt fails — forces the app back to the Login screen.
class AuthSessionExpired extends AuthEvent {
  const AuthSessionExpired();
}
