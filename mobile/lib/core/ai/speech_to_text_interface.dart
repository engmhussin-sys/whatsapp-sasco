/// PHASE 2 READINESS — mirrors backend/src/modules/voice-processing exactly.
/// No AI is implemented here in Phase 1; this interface exists purely so
/// the Chat feature's voice-message UI can already be written against the
/// final shape (e.g. showing a transcription once available) without a
/// rewrite when Phase 2 wires in a real STT provider.
abstract class SpeechToTextService {
  Future<String> transcribe({required String audioFilePath, String? languageHint});
}

/// Phase 1 no-op — matches backend's NoopSpeechToTextProvider.
class NoopSpeechToTextService implements SpeechToTextService {
  @override
  Future<String> transcribe({required String audioFilePath, String? languageHint}) async {
    return '[سيتم تفعيل تحويل الصوت إلى نص في المرحلة الثانية]';
  }
}
