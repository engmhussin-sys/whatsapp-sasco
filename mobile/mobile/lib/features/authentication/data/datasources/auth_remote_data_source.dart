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
  Future<AuthTokens> login({String? email, String? phone, required String password, String? companyId});
  Future<void> logout(String refreshToken);
  Future<void> requestPasswordReset(String email);
  Future<void> resetPassword({required String resetToken, required String newPassword});
  Future<UserModel> updatePreferredLanguage({required String companyId, required String userId, required String languageCode});
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final DioClient _client;
  AuthRemoteDataSourceImpl(this._client);

  @override
  Future<AuthTokens> login({String? email, String? phone, required String password, String? companyId}) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.login,
      data: {
        if (email != null && email.isNotEmpty) 'email': email,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
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

  @override
  Future<UserModel> updatePreferredLanguage({
    required String companyId,
    required String userId,
    required String languageCode,
  }) async {
    final data = await _client.patch<Map<String, dynamic>>(
      ApiConstants.updateUser(companyId, userId),
      data: {'preferredLanguage': languageCode},
    );
    return UserModel.fromJson(data);
  }
}
