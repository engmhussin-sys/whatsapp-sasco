import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/entities/approval_entity.dart';
import '../models/approval_model.dart';

abstract class ApprovalsRemoteDataSource {
  Future<List<ApprovalModel>> getMyPendingApprovals(String companyId);
  Future<ApprovalModel> act(String companyId, String approvalId, ApprovalActionType action, String? comment);
}

class ApprovalsRemoteDataSourceImpl implements ApprovalsRemoteDataSource {
  final DioClient _client;
  ApprovalsRemoteDataSourceImpl(this._client);

  @override
  Future<List<ApprovalModel>> getMyPendingApprovals(String companyId) async {
    final data = await _client.get<List<dynamic>>(
      ApiConstants.approvals(companyId),
      queryParameters: {'mine': 'true'},
    );
    return data.map((e) => ApprovalModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<ApprovalModel> act(String companyId, String approvalId, ApprovalActionType action, String? comment) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.approvalActions(companyId, approvalId),
      data: {'action': _actionToString(action), if (comment != null) 'comment': comment},
    );
    return ApprovalModel.fromJson(data);
  }

  String _actionToString(ApprovalActionType a) {
    switch (a) {
      case ApprovalActionType.approve:
        return 'APPROVE';
      case ApprovalActionType.reject:
        return 'REJECT';
      case ApprovalActionType.returnAction:
        return 'RETURN';
      case ApprovalActionType.comment:
        return 'COMMENT';
    }
  }
}
