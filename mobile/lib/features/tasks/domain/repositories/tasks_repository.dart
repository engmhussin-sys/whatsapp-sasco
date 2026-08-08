import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/task_entity.dart';

abstract class TasksRepository {
  Future<Either<Failure, List<TaskEntity>>> getTasks(String companyId, {String? status, String? assignedToUserId});
  Future<Either<Failure, TaskEntity>> getTask(String companyId, String taskId);
  Future<Either<Failure, TaskEntity>> startTask(String companyId, String taskId);
  Future<Either<Failure, String>> submitResponse(String companyId, String taskId, Map<String, dynamic> answers);
  Future<Either<Failure, void>> uploadAttachment(
    String companyId,
    String responseId,
    String filePath,
    String fieldId,
    String kind,
  );
}
