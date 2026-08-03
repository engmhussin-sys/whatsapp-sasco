import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  // Exactly one of email/phone must be provided — mirrors the backend's
  // LoginDto (auth.service.ts), which accepts either.
  Future<Either<Failure, UserEntity>> login({
    String? email,
    String? phone,
    required String password,
    String? companyId,
  });

  Future<Either<Failure, void>> logout();

  Future<Either<Failure, void>> requestPasswordReset(String email);

  Future<Either<Failure, void>> resetPassword({required String resetToken, required String newPassword});

  /// Reads the locally persisted session (secure storage) without a
  /// network call — used at app startup (Splash) to decide whether to
  /// route to Login or Home. Session VALIDITY (is the token still
  /// accepted by the server) is checked lazily on the first authenticated
  /// request, via AuthInterceptor's refresh flow, rather than here.
  Future<Either<Failure, UserEntity?>> getCurrentUser();

  /// T5: persists the language change to the server (the Translation
  /// Engine reads user.preferredLanguage server-side — a local-only
  /// change does nothing), then also updates local secure storage so
  /// the app opens in the right language before the network responds.
  Future<Either<Failure, UserEntity>> updatePreferredLanguage(String languageCode);
}
