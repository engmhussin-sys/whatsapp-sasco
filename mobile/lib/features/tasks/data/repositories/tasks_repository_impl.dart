import 'package:dartz/dartz.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/task_entity.dart';
import '../../domain/repositories/tasks_repository.dart';
import '../datasources/tasks_remote_data_source.dart';

class TasksRepositoryImpl implements TasksRepository {
  final TasksRemoteDataSource _remote;
  TasksRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<TaskEntity>>> getTasks(String companyId, {String? status, String? assignedToUserId}) async {
    try {
      return Right(await _remote.getTasks(companyId, status: status, assignedToUserId: assignedToUserId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, TaskEntity>> getTask(String companyId, String taskId) async {
    try {
      return Right(await _remote.getTask(companyId, taskId));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }

  @override
  Future<Either<Failure, String>> submitResponse(String companyId, String taskId, Map<String, dynamic> answers) async {
    try {
      return Right(await _remote.submitResponse(companyId, taskId, answers));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ValidationException catch (e) {
      return Left(ValidationFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, void>> uploadAttachment(
    String companyId,
    String responseId,
    String filePath,
    String fieldId,
    String kind,
  ) async {
    try {
      await _remote.uploadAttachment(companyId, responseId, filePath, fieldId, kind);
      return const Right(null);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    } on NetworkException {
      return const Left(NetworkFailure());
    }
  }
}
