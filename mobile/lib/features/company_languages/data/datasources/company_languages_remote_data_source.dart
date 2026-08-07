import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/dio_client.dart';
import '../models/language_model.dart';

abstract class CompanyLanguagesRemoteDataSource {
  /// GET /languages — الكتالوج الكامل، بصرف النظر عن أي شركة.
  Future<List<LanguageModel>> fetchAllLanguages();

  /// GET /companies/:id/languages — اللغات المُفعَّلة حالياً لهذه الشركة.
  Future<List<LanguageModel>> fetchEnabledForCompany(String companyId);

  Future<void> enable(String companyId, String langCode);
  Future<void> disable(String companyId, String langCode);
}

class CompanyLanguagesRemoteDataSourceImpl implements CompanyLanguagesRemoteDataSource {
  final DioClient _client;
  CompanyLanguagesRemoteDataSourceImpl(this._client);

  @override
  Future<List<LanguageModel>> fetchAllLanguages() async {
    final data = await _client.get<List<dynamic>>(ApiConstants.allLanguages);
    return data.map((e) => LanguageModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<LanguageModel>> fetchEnabledForCompany(String companyId) async {
    final data = await _client.get<List<dynamic>>(ApiConstants.companyLanguages(companyId));
    return data.map((e) => LanguageModel.fromCompanyLanguageJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> enable(String companyId, String langCode) =>
      _client.post<dynamic>(ApiConstants.companyLanguages(companyId), data: {'langCode': langCode});

  @override
  Future<void> disable(String companyId, String langCode) =>
      _client.delete<dynamic>(ApiConstants.companyLanguageByCode(companyId, langCode));
}
