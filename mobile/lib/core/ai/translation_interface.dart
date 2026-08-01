/// PHASE 2 READINESS — mirrors backend's TranslationProvider interface.
abstract class TranslationService {
  Future<String> translate({required String text, required String sourceLanguage, required String targetLanguage});
}

class NoopTranslationService implements TranslationService {
  @override
  Future<String> translate({required String text, required String sourceLanguage, required String targetLanguage}) async {
    return text; // pass-through, not a real translation — Phase 2
  }
}
