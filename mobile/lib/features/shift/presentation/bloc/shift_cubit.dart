import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/shift_entity.dart';
import '../../domain/usecases/shift_usecases.dart';

enum ShiftScreenStatus { initial, loading, success, failure }

class ShiftScreenState extends Equatable {
  final ShiftScreenStatus status;
  final List<ShiftEntity> shifts;
  final List<ShiftLogEntity> myLogs;
  final bool isBusy;
  final String? errorMessage;

  const ShiftScreenState({
    this.status = ShiftScreenStatus.initial,
    this.shifts = const [],
    this.myLogs = const [],
    this.isBusy = false,
    this.errorMessage,
  });

  ShiftLogEntity? get openLog {
    for (final log in myLogs) {
      if (log.status == ShiftLogStatus.open) return log;
    }
    return null;
  }

  ShiftScreenState copyWith({
    ShiftScreenStatus? status,
    List<ShiftEntity>? shifts,
    List<ShiftLogEntity>? myLogs,
    bool? isBusy,
    String? errorMessage,
  }) {
    return ShiftScreenState(
      status: status ?? this.status,
      shifts: shifts ?? this.shifts,
      myLogs: myLogs ?? this.myLogs,
      isBusy: isBusy ?? this.isBusy,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, shifts, myLogs, isBusy, errorMessage];
}

class ShiftCubit extends Cubit<ShiftScreenState> {
  final GetShiftsUseCase _getShifts;
  final GetMyShiftLogsUseCase _getMyShiftLogs;
  final OpenShiftUseCase _openShift;
  final CloseShiftUseCase _closeShift;
  final String companyId;

  ShiftCubit({
    required GetShiftsUseCase getShifts,
    required GetMyShiftLogsUseCase getMyShiftLogs,
    required OpenShiftUseCase openShift,
    required CloseShiftUseCase closeShift,
    required this.companyId,
  })  : _getShifts = getShifts,
        _getMyShiftLogs = getMyShiftLogs,
        _openShift = openShift,
        _closeShift = closeShift,
        super(const ShiftScreenState());

  Future<void> load() async {
    emit(state.copyWith(status: ShiftScreenStatus.loading));
    final shiftsResult = await _getShifts(CompanyParams(companyId));
    final logsResult = await _getMyShiftLogs(CompanyParams(companyId));

    shiftsResult.fold(
      (failure) => emit(state.copyWith(status: ShiftScreenStatus.failure, errorMessage: failure.message)),
      (shifts) => logsResult.fold(
        (failure) => emit(state.copyWith(status: ShiftScreenStatus.failure, errorMessage: failure.message)),
        (logs) => emit(state.copyWith(status: ShiftScreenStatus.success, shifts: shifts, myLogs: logs)),
      ),
    );
  }

  Future<void> open(String shiftId, {String? stationId}) async {
    emit(state.copyWith(isBusy: true));
    final result = await _openShift(OpenShiftParams(companyId: companyId, shiftId: shiftId, stationId: stationId));
    result.fold(
      (failure) => emit(state.copyWith(isBusy: false, errorMessage: failure.message)),
      (_) {
        emit(state.copyWith(isBusy: false));
        load();
      },
    );
  }

  Future<void> closeShift(String shiftLogId) async {
    emit(state.copyWith(isBusy: true));
    final result = await _closeShift(CloseShiftParams(companyId: companyId, shiftLogId: shiftLogId));
    result.fold(
      (failure) => emit(state.copyWith(isBusy: false, errorMessage: failure.message)),
      (_) {
        emit(state.copyWith(isBusy: false));
        load();
      },
    );
  }
}
