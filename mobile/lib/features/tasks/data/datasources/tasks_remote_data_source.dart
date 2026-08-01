import 'package:dio/dio.dart' as dio;
import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/task_model.dart';

abstract class TasksRemoteDataSource {
  Future<List<TaskModel>> getTasks(String companyId, {String? status, String? assignedToUserId});
  Future<TaskModel> getTask(String companyId, String taskId);
  Future<String> submitResponse(String companyId, String taskId, Map<String, dynamic> answers);
  Future<void> uploadAttachment(String companyId, String responseId, String filePath, String fieldId, String kind);
}

class TasksRemoteDataSourceImpl implements TasksRemoteDataSource {
  final DioClient _client;
  TasksRemoteDataSourceImpl(this._client);

  @override
  Future<List<TaskModel>> getTasks(String companyId, {String? status, String? assignedToUserId}) async {
    final data = await _client.get<List<dynamic>>(
      ApiConstants.tasks(companyId),
      queryParameters: {
        if (status != null) 'status': status,
        if (assignedToUserId != null) 'assignedToUserId': assignedToUserId,
      },
    );
    return data.map((e) => TaskModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<TaskModel> getTask(String companyId, String taskId) async {
    final data = await _client.get<Map<String, dynamic>>(ApiConstants.taskById(companyId, taskId));
    return TaskModel.fromJson(data);
  }

  @override
  Future<String> submitResponse(String companyId, String taskId, Map<String, dynamic> answers) async {
    final data = await _client.post<Map<String, dynamic>>(
      ApiConstants.taskResponses(companyId, taskId),
      data: {'answers': answers},
    );
    final responses = data['responses'] as List<dynamic>? ?? [];
    if (responses.isEmpty) return '';
    // newest response = highest submittedAt
    responses.sort((a, b) => (b['submittedAt'] as String).compareTo(a['submittedAt'] as String));
    return (responses.first as Map<String, dynamic>)['id'] as String;
  }

  @override
  Future<void> uploadAttachment(String companyId, String responseId, String filePath, String fieldId, String kind) async {
    final formData = dio.FormData.fromMap({
      'file': await dio.MultipartFile.fromFile(filePath),
      'fieldId': fieldId,
      'kind': kind,
    });
    await _client.post<dynamic>(ApiConstants.taskResponseAttachments(companyId, responseId), data: formData);
  }
}
