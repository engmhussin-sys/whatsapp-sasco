import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/joinable_group_model.dart';
import '../models/join_request_model.dart';

abstract class JoinRequestRemoteDataSource {
  Future<List<JoinableGroupModel>> getJoinableGroups(String companyId);
  Future<void> requestToJoin(String companyId, String conversationId);
  Future<List<JoinRequestModel>> getPendingRequests(String companyId, String conversationId);
  Future<void> decideRequest(String companyId, String requestId, {required bool approve});
}

class JoinRequestRemoteDataSourceImpl implements JoinRequestRemoteDataSource {
  final DioClient _client;
  JoinRequestRemoteDataSourceImpl(this._client);

  @override
  Future<List<JoinableGroupModel>> getJoinableGroups(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.joinableGroups(companyId));
    return data.map((e) => JoinableGroupModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> requestToJoin(String companyId, String conversationId) async {
    await _client.post<Map<String, dynamic>>(ApiConstants.joinRequest(companyId, conversationId));
  }

  @override
  Future<List<JoinRequestModel>> getPendingRequests(String companyId, String conversationId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.pendingJoinRequests(companyId, conversationId));
    return data.map((e) => JoinRequestModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> decideRequest(String companyId, String requestId, {required bool approve}) async {
    await _client.post<Map<String, dynamic>>(
      ApiConstants.decideJoinRequest(companyId, requestId),
      data: {'approve': approve},
    );
  }
}
