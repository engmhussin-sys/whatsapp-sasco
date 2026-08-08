import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/task_entity.dart';
import '../repositories/tasks_repository.dart';

/// NOTE ON SCOPE: unlike Authentication/Chat (one usecase class per
/// operation, matching their heavier real business logic), Tasks'
/// usecases are thin 1:1 wrappers around the repository with no
/// additional logic of their own — so they're grouped in a single file
/// to keep the feature's file count proportional to its actual
/// complexity, per the scoping agreed for this delivery. The Clean
/// Architecture boundary (Bloc depends on UseCase, not directly on
/// Repository) is still fully respected.

class GetTasksParams extends Equatable {
  final String companyId;
  final String? status;
  final String? assignedToUserId;
  const GetTasksParams({required this.companyId, this.status, this.assignedToUserId});
  @override
  List<Object?> get props => [companyId, status, assignedToUserId];
}

class GetTasksUseCase implements UseCase<List<TaskEntity>, GetTasksParams> {
  final TasksRepository repository;
  GetTasksUseCase(this.repository);
  @override
  Future<Either<Failure, List<TaskEntity>>> call(GetTasksParams params) =>
      repository.getTasks(params.companyId, status: params.status, assignedToUserId: params.assignedToUserId);
}

class GetTaskParams extends Equatable {
  final String companyId;
  final String taskId;
  const GetTaskParams({required this.companyId, required this.taskId});
  @override
  List<Object?> get props => [companyId, taskId];
}

class GetTaskUseCase implements UseCase<TaskEntity, GetTaskParams> {
  final TasksRepository repository;
  GetTaskUseCase(this.repository);
  @override
  Future<Either<Failure, TaskEntity>> call(GetTaskParams params) => repository.getTask(params.companyId, params.taskId);
}

class StartTaskUseCase implements UseCase<TaskEntity, GetTaskParams> {
  final TasksRepository repository;
  StartTaskUseCase(this.repository);
  @override
  Future<Either<Failure, TaskEntity>> call(GetTaskParams params) => repository.startTask(params.companyId, params.taskId);
}

class SubmitTaskResponseParams extends Equatable {
  final String companyId;
  final String taskId;
  final Map<String, dynamic> answers;
  const SubmitTaskResponseParams({required this.companyId, required this.taskId, required this.answers});
  @override
  List<Object?> get props => [companyId, taskId, answers];
}

/// Returns the new TaskResponse id (needed by the caller to upload any
/// media-field attachments against it — see backend's TaskAttachment model).
class SubmitTaskResponseUseCase implements UseCase<String, SubmitTaskResponseParams> {
  final TasksRepository repository;
  SubmitTaskResponseUseCase(this.repository);
  @override
  Future<Either<Failure, String>> call(SubmitTaskResponseParams params) =>
      repository.submitResponse(params.companyId, params.taskId, params.answers);
}

class UploadTaskAttachmentParams extends Equatable {
  final String companyId;
  final String responseId;
  final String filePath;
  final String fieldId;
  final String kind;
  const UploadTaskAttachmentParams({
    required this.companyId,
    required this.responseId,
    required this.filePath,
    required this.fieldId,
    required this.kind,
  });
  @override
  List<Object?> get props => [companyId, responseId, filePath, fieldId, kind];
}

class UploadTaskAttachmentUseCase implements UseCase<void, UploadTaskAttachmentParams> {
  final TasksRepository repository;
  UploadTaskAttachmentUseCase(this.repository);
  @override
  Future<Either<Failure, void>> call(UploadTaskAttachmentParams params) =>
      repository.uploadAttachment(params.companyId, params.responseId, params.filePath, params.fieldId, params.kind);
}
