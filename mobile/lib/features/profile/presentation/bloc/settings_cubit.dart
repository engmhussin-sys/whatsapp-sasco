import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/repositories/settings_repository.dart';

class SettingsState extends Equatable {
  final String localeCode;
  final bool isDarkMode;

  const SettingsState({this.localeCode = 'ar', this.isDarkMode = false});

  SettingsState copyWith({String? localeCode, bool? isDarkMode}) =>
      SettingsState(localeCode: localeCode ?? this.localeCode, isDarkMode: isDarkMode ?? this.isDarkMode);

  @override
  List<Object?> get props => [localeCode, isDarkMode];
}

class SettingsCubit extends Cubit<SettingsState> {
  final SettingsRepository _repository;
  SettingsCubit(this._repository) : super(const SettingsState()) {
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    final locale = await _repository.getLocale();
    final isDark = await _repository.isDarkMode();
    emit(SettingsState(localeCode: locale, isDarkMode: isDark));
  }

  Future<void> changeLocale(String localeCode) async {
    await _repository.setLocale(localeCode);
    emit(state.copyWith(localeCode: localeCode));
  }

  Future<void> toggleDarkMode(bool isDark) async {
    await _repository.setDarkMode(isDark);
    emit(state.copyWith(isDarkMode: isDark));
  }
}
