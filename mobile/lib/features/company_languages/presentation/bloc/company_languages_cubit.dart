import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/language_entity.dart';
import '../../domain/repositories/company_languages_repository.dart';

enum CompanyLanguagesStatus { initial, loading, success, failure }

class CompanyLanguagesState extends Equatable {
  final CompanyLanguagesStatus status;
  final List<LanguageEntity> allLanguages;
  final Set<String> enabledCodes;
  // معرِّفات اللغات التي يجري تبديل حالتها الآن (لتعطيل مفتاحها مؤقتاً
  // ومنع نقرات متكررة أثناء انتظار استجابة الخادم).
  final Set<String> pendingCodes;
  final String? errorMessage;

  const CompanyLanguagesState({
    this.status = CompanyLanguagesStatus.initial,
    this.allLanguages = const [],
    this.enabledCodes = const {},
    this.pendingCodes = const {},
    this.errorMessage,
  });

  CompanyLanguagesState copyWith({
    CompanyLanguagesStatus? status,
    List<LanguageEntity>? allLanguages,
    Set<String>? enabledCodes,
    Set<String>? pendingCodes,
    String? errorMessage,
  }) {
    return CompanyLanguagesState(
      status: status ?? this.status,
      allLanguages: allLanguages ?? this.allLanguages,
      enabledCodes: enabledCodes ?? this.enabledCodes,
      pendingCodes: pendingCodes ?? this.pendingCodes,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, allLanguages, enabledCodes, pendingCodes, errorMessage];
}

class CompanyLanguagesCubit extends Cubit<CompanyLanguagesState> {
  final CompanyLanguagesRepository _repository;
  final String companyId;
  CompanyLanguagesCubit(this._repository, this.companyId) : super(const CompanyLanguagesState());

  Future<void> load() async {
    emit(state.copyWith(status: CompanyLanguagesStatus.loading));
    final allResult = await _repository.getAllLanguages();
    final enabledResult = await _repository.getEnabledForCompany(companyId);

    // النوع مُحدَّد صراحة (Failure?) بدل الاعتماد على استنتاج ضمني عبر
    // closures مختلفة القيمة المُعادة — أوضح وأكثر أماناً مع إعدادات
    // تحليل صارمة (strict-inference).
    final failure = allResult.fold<Failure?>((f) => f, (_) => null) ?? enabledResult.fold<Failure?>((f) => f, (_) => null);
    if (failure != null) {
      emit(state.copyWith(status: CompanyLanguagesStatus.failure, errorMessage: failure.message));
      return;
    }

    final all = allResult.getOrElse(() => const []);
    final enabled = enabledResult.getOrElse(() => const []);
    emit(state.copyWith(
      status: CompanyLanguagesStatus.success,
      allLanguages: all,
      enabledCodes: enabled.map((l) => l.code).toSet(),
      errorMessage: null,
    ));
  }

  /// تبديل تفاؤلي (optimistic): يُحدِّث الواجهة فوراً، ويتراجع إن فشل
  /// الخادم — يمنع شعور المستخدم ببطء عند كل نقرة على شبكة بطيئة.
  Future<void> toggle(String langCode, bool enable) async {
    if (state.pendingCodes.contains(langCode)) return;

    final previousEnabled = Set<String>.from(state.enabledCodes);
    final optimisticEnabled = Set<String>.from(state.enabledCodes);
    if (enable) {
      optimisticEnabled.add(langCode);
    } else {
      optimisticEnabled.remove(langCode);
    }

    emit(state.copyWith(
      enabledCodes: optimisticEnabled,
      pendingCodes: {...state.pendingCodes, langCode},
      errorMessage: null,
    ));

    final result = enable ? await _repository.enable(companyId, langCode) : await _repository.disable(companyId, langCode);

    result.fold(
      (failure) => emit(state.copyWith(
        enabledCodes: previousEnabled, // تراجع
        pendingCodes: state.pendingCodes.difference({langCode}),
        errorMessage: failure.message,
      )),
      (_) => emit(state.copyWith(
        pendingCodes: state.pendingCodes.difference({langCode}),
      )),
    );
  }
}
