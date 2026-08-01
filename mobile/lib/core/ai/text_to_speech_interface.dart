/// PHASE 2 READINESS — mirrors backend's TextToSpeechProvider interface.
abstract class TextToSpeechService {
  Future<String?> synthesize({required String text, required String languageCode});
}

class NoopTextToSpeechService implements TextToSpeechService {
  @override
  Future<String?> synthesize({required String text, required String languageCode}) async => null;
}
