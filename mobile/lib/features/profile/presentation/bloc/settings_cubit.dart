import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/repositories/settings_repository.dart';

class SettingsState extends Equatable {
  final String localeCode;
  final bool isDarkMode;
  final bool readAloudEnabled;
  final bool largeTextEnabled;
  final bool showOriginalEnabled;

  const SettingsState({
    this.localeCode = 'ar',
    this.isDarkMode = false,
    this.readAloudEnabled = false,
    this.largeTextEnabled = false,
    this.showOriginalEnabled = true,
  });

  SettingsState copyWith({
    String? localeCode,
    bool? isDarkMode,
    bool? readAloudEnabled,
    bool? largeTextEnabled,
    bool? showOriginalEnabled,
  }) =>
      SettingsState(
        localeCode: localeCode ?? this.localeCode,
        isDarkMode: isDarkMode ?? this.isDarkMode,
        readAloudEnabled: readAloudEnabled ?? this.readAloudEnabled,
        largeTextEnabled: largeTextEnabled ?? this.largeTextEnabled,
        showOriginalEnabled: showOriginalEnabled ?? this.showOriginalEnabled,
      );

  @override
  List<Object?> get props => [localeCode, isDarkMode, readAloudEnabled, largeTextEnabled, showOriginalEnabled];
}

class SettingsCubit extends Cubit<SettingsState> {
  final SettingsRepository _repository;
  SettingsCubit(this._repository) : super(const SettingsState()) {
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    final locale = await _repository.getLocale();
    final isDark = await _repository.isDarkMode();
    final readAloud = await _repository.isReadAloudEnabled();
    final largeText = await _repository.isLargeTextEnabled();
    final showOriginal = await _repository.isShowOriginalEnabled();
    emit(SettingsState(
      localeCode: locale,
      isDarkMode: isDark,
      readAloudEnabled: readAloud,
      largeTextEnabled: largeText,
      showOriginalEnabled: showOriginal,
    ));
  }

  Future<void> changeLocale(String localeCode) async {
    await _repository.setLocale(localeCode);
    emit(state.copyWith(localeCode: localeCode));
  }

  Future<void> toggleDarkMode(bool isDark) async {
    await _repository.setDarkMode(isDark);
    emit(state.copyWith(isDarkMode: isDark));
  }

  Future<void> toggleReadAloud(bool enabled) async {
    await _repository.setReadAloudEnabled(enabled);
    emit(state.copyWith(readAloudEnabled: enabled));
  }

  Future<void> toggleLargeText(bool enabled) async {
    await _repository.setLargeTextEnabled(enabled);
    emit(state.copyWith(largeTextEnabled: enabled));
  }

  Future<void> toggleShowOriginal(bool enabled) async {
    await _repository.setShowOriginalEnabled(enabled);
    emit(state.copyWith(showOriginalEnabled: enabled));
  }
}
