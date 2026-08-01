import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/user_model.dart';

class AuthTokens {
  final String accessToken;
  final String refreshToken;
  final UserModel user;
  AuthTokens({required this.accessToken, required this.refreshToken, required this.user});
}

abstract class AuthRemoteDataSource {
  Future<AuthTokens> login({required String email, required String password, String? companyId});
  Future<void> logout(String refreshToken);
  Future<void> requestPasswordReset(String email);
  Future<void> resetPassword({required String resetToken, required String newPassword});
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient _client;
  AuthRemoteDataSourceImpl(this._client);

  @override
  Future<AuthTokens> login({required String email, required String password, String? companyId}) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.login,
      data: {
        'email': email,
        'password': password,
        if (companyId != null && companyId.isNotEmpty) 'companyId': companyId,
      },
      skipAuth: true,
    );
    return AuthTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      user: UserModel.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  @override
  Future<void> logout(String refreshToken) async {
    await _client.post<dynamic>(ApiConstants.logout, data: {'refreshToken': refreshToken}, skipAuth: true);
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    await _client.post<dynamic>(ApiConstants.forgotPassword, data: {'email': email}, skipAuth: true);
  }

  @override
  Future<void> resetPassword({required String resetToken, required String newPassword}) async {
    await _client.post<dynamic>(
      ApiConstants.resetPassword,
      data: {'resetToken': resetToken, 'newPassword': newPassword},
      skipAuth: true,
    );
  }
}
