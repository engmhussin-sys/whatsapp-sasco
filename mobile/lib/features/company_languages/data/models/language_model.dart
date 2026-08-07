import '../../domain/entities/language_entity.dart';

class LanguageModel extends LanguageEntity {
  const LanguageModel({required super.code, required super.name, required super.nativeName, required super.isRtl});

  factory LanguageModel.fromJson(Map<String, dynamic> json) => LanguageModel(
        code: json['code'] as String,
        name: json['name'] as String,
        nativeName: json['nativeName'] as String,
        isRtl: json['isRtl'] as bool? ?? false,
      );

  /// GET /companies/:id/languages returns {companyId, langCode, language: {...}}
  /// — the nested `language` object, not the row itself, has the fields we need.
  factory LanguageModel.fromCompanyLanguageJson(Map<String, dynamic> json) =>
      LanguageModel.fromJson(json['language'] as Map<String, dynamic>);
}
