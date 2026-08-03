import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/directory_user_model.dart';

abstract class DirectoryRemoteDataSource {
  Future<List<DirectoryUserModel>> searchUsers(String companyId, {String? search});
}

class DirectoryRemoteDataSourceImpl implements DirectoryRemoteDataSource {
  final DioClient _client;
  DirectoryRemoteDataSourceImpl(this._client);

  @override
  Future<List<DirectoryUserModel>> searchUsers(String companyId, {String? search}) async {
    final data = await _client.get<List<dynamic>>(
      ApiConstants.directoryUsers(companyId),
      queryParameters: search != null && search.trim().isNotEmpty ? {'search': search.trim()} : null,
    );
    return data.map((e) => DirectoryUserModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
