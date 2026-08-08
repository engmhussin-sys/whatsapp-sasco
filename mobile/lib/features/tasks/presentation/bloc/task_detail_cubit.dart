import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/task_entity.dart';
import '../../domain/usecases/tasks_usecases.dart';

enum TaskDetailStatus { initial, loading, loaded, submitting, submitted, failure }

class TaskDetailState extends Equatable {
  final TaskDetailStatus status;
  final TaskEntity? task;
  final String? errorMessage;

  const TaskDetailState({this.status = TaskDetailStatus.initial, this.task, this.errorMessage});

  TaskDetailState copyWith({TaskDetailStatus? status, TaskEntity? task, String? errorMessage}) => TaskDetailState(
        status: status ?? this.status,
        task: task ?? this.task,
        errorMessage: errorMessage,
      );

  @override
  List<Object?> get props => [status, task, errorMessage];
}

/// Cubit (simpler than Bloc — no discrete Event classes) chosen deliberately
/// for this single-purpose screen: fetch one task, submit one form. Bloc is
/// used everywhere state transitions are driven by multiple distinct
/// triggers (Auth, Chat); Cubit is used where a screen's logic is just a
/// handful of straightforward async methods — both are part of the same
/// package:flutter_bloc family the architecture calls for.
class TaskDetailCubit extends Cubit<TaskDetailState> {
  final GetTaskUseCase _getTask;
  final StartTaskUseCase _startTask;
  final SubmitTaskResponseUseCase _submitResponse;
  final UploadTaskAttachmentUseCase _uploadAttachment;
  final String companyId;
  final String taskId;

  TaskDetailCubit({
    required GetTaskUseCase getTask,
    required StartTaskUseCase startTask,
    required SubmitTaskResponseUseCase submitResponse,
    required UploadTaskAttachmentUseCase uploadAttachment,
    required this.companyId,
    required this.taskId,
  })  : _getTask = getTask,
        _startTask = startTask,
        _submitResponse = submitResponse,
        _uploadAttachment = uploadAttachment,
        super(const TaskDetailState());

  Future<void> load() async {
    emit(state.copyWith(status: TaskDetailStatus.loading));
    final result = await _getTask(GetTaskParams(companyId: companyId, taskId: taskId));
    result.fold(
      (failure) => emit(state.copyWith(status: TaskDetailStatus.failure, errorMessage: failure.message)),
      (task) => emit(state.copyWith(status: TaskDetailStatus.loaded, task: task)),
    );
  }

  /// ينقل المهمة من ASSIGNED إلى IN_PROGRESS — الخادم يتحقق أن المستخدم
  /// الحالي أحد المُكلَّفين فعلياً بها قبل السماح بذلك.
  Future<void> start() async {
    final result = await _startTask(GetTaskParams(companyId: companyId, taskId: taskId));
    result.fold(
      (failure) => emit(state.copyWith(status: TaskDetailStatus.failure, errorMessage: failure.message)),
      (task) => emit(state.copyWith(status: TaskDetailStatus.loaded, task: task)),
    );
  }

  /// [answers] holds direct values for simple fields; [filesByField] holds
  /// local file paths for PHOTO/VIDEO/AUDIO/SIGNATURE fields, uploaded as
  /// TaskAttachments against the response created by the first call.
  Future<void> submit({
    required Map<String, dynamic> answers,
    required Map<String, String> filesByField,
    required Map<String, String> fieldKinds,
  }) async {
    emit(state.copyWith(status: TaskDetailStatus.submitting));

    final finalAnswers = {...answers};
    for (final fieldId in filesByField.keys) {
      finalAnswers[fieldId] = {'pendingUpload': true};
    }

    final result = await _submitResponse(
      SubmitTaskResponseParams(companyId: companyId, taskId: taskId, answers: finalAnswers),
    );

    await result.fold(
      (failure) async => emit(state.copyWith(status: TaskDetailStatus.failure, errorMessage: failure.message)),
      (responseId) async {
        if (responseId.isNotEmpty) {
          for (final entry in filesByField.entries) {
            await _uploadAttachment(UploadTaskAttachmentParams(
              companyId: companyId,
              responseId: responseId,
              filePath: entry.value,
              fieldId: entry.key,
              kind: fieldKinds[entry.key] ?? 'DOCUMENT',
            ));
          }
        }
        emit(state.copyWith(status: TaskDetailStatus.submitted));
      },
    );
  }
}
