import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/task_entity.dart';
import '../../domain/usecases/tasks_usecases.dart';

part 'tasks_event.dart';
part 'tasks_state.dart';

class TasksBloc extends Bloc<TasksEvent, TasksState> {
  final GetTasksUseCase _getTasks;
  final String companyId;
  final String currentUserId;

  TasksBloc({required GetTasksUseCase getTasks, required this.companyId, required this.currentUserId})
      : _getTasks = getTasks,
        super(const TasksState()) {
    on<TasksRequested>(_onRequested);
  }

  Future<void> _onRequested(TasksRequested event, Emitter<TasksState> emit) async {
    emit(state.copyWith(status: TasksStatus.loading));
    final result = await _getTasks(GetTasksParams(companyId: companyId, status: event.status, assignedToUserId: currentUserId));
    result.fold(
      (failure) => emit(state.copyWith(status: TasksStatus.failure, errorMessage: failure.message)),
      (tasks) => emit(state.copyWith(status: TasksStatus.success, tasks: tasks)),
    );
  }
}
