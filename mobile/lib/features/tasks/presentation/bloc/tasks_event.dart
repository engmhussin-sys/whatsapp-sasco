part of 'tasks_bloc.dart';

abstract class TasksEvent extends Equatable {
  const TasksEvent();
  @override
  List<Object?> get props => [];
}

class TasksRequested extends TasksEvent {
  final String? status;
  const TasksRequested({this.status});
  @override
  List<Object?> get props => [status];
}
