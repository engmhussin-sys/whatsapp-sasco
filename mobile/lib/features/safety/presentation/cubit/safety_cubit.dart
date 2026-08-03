import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/hazard_report_entity.dart';
import '../../domain/entities/sos_alert_entity.dart';
import '../../domain/repositories/safety_repository.dart';

enum SafetySubmitStatus { idle, submitting, success, failure }

class SafetyState extends Equatable {
  final List<HazardReportEntity> hazards;
  final bool isLoadingHazards;
  final SafetySubmitStatus hazardSubmitStatus;
  final SafetySubmitStatus sosStatus;
  final SosAlertEntity? lastSosAlert;
  final String? errorMessage;

  const SafetyState({
    this.hazards = const [],
    this.isLoadingHazards = false,
    this.hazardSubmitStatus = SafetySubmitStatus.idle,
    this.sosStatus = SafetySubmitStatus.idle,
    this.lastSosAlert,
    this.errorMessage,
  });

  SafetyState copyWith({
    List<HazardReportEntity>? hazards,
    bool? isLoadingHazards,
    SafetySubmitStatus? hazardSubmitStatus,
    SafetySubmitStatus? sosStatus,
    SosAlertEntity? lastSosAlert,
    String? errorMessage,
    bool clearError = false,
  }) {
    return SafetyState(
      hazards: hazards ?? this.hazards,
      isLoadingHazards: isLoadingHazards ?? this.isLoadingHazards,
      hazardSubmitStatus: hazardSubmitStatus ?? this.hazardSubmitStatus,
      sosStatus: sosStatus ?? this.sosStatus,
      lastSosAlert: lastSosAlert ?? this.lastSosAlert,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props =>
      [hazards, isLoadingHazards, hazardSubmitStatus, sosStatus, lastSosAlert, errorMessage];
}

class SafetyCubit extends Cubit<SafetyState> {
  final SafetyRepository _repository;
  final String companyId;

  SafetyCubit({required SafetyRepository repository, required this.companyId})
      : _repository = repository,
        super(const SafetyState());

  Future<void> loadHazards() async {
    emit(state.copyWith(isLoadingHazards: true, clearError: true));
    final result = await _repository.listHazards(companyId);
    result.fold(
      (failure) => emit(state.copyWith(isLoadingHazards: false, errorMessage: failure.message)),
      (hazards) => emit(state.copyWith(isLoadingHazards: false, hazards: hazards)),
    );
  }

  Future<void> reportHazard({required HazardKind kind, String? stationId, String? note, String? photoUrl}) async {
    emit(state.copyWith(hazardSubmitStatus: SafetySubmitStatus.submitting, clearError: true));
    final result = await _repository.reportHazard(companyId, kind: kind, stationId: stationId, note: note, photoUrl: photoUrl);
    result.fold(
      (failure) => emit(state.copyWith(hazardSubmitStatus: SafetySubmitStatus.failure, errorMessage: failure.message)),
      (hazard) => emit(state.copyWith(
        hazardSubmitStatus: SafetySubmitStatus.success,
        hazards: [hazard, ...state.hazards],
      )),
    );
  }

  Future<void> raiseSos({String? stationId, double? latitude, double? longitude}) async {
    emit(state.copyWith(sosStatus: SafetySubmitStatus.submitting, clearError: true));
    final result = await _repository.raiseSos(companyId, stationId: stationId, latitude: latitude, longitude: longitude);
    result.fold(
      (failure) => emit(state.copyWith(sosStatus: SafetySubmitStatus.failure, errorMessage: failure.message)),
      (alert) => emit(state.copyWith(sosStatus: SafetySubmitStatus.success, lastSosAlert: alert)),
    );
  }

  void resetSubmitStatus() =>
      emit(state.copyWith(hazardSubmitStatus: SafetySubmitStatus.idle, sosStatus: SafetySubmitStatus.idle));
}
