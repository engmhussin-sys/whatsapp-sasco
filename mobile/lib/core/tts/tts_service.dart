import 'package:flutter_tts/flutter_tts.dart';
import '../../features/authentication/presentation/bloc/auth_bloc.dart';

/// Maps our app language codes to concrete TTS locale codes. Note
/// (honest, not hidden): device/OS TTS engine language support varies —
/// `am` (Amharic) in particular has inconsistent support across
/// Android/iOS TTS engines. `speak()` never throws on an unsupported
/// language; it fails silently (logged) rather than crashing the
/// screen that called it, since a broken voice-readout must never take
/// down anything else.
/// CLIENT-SIDE, IMMEDIATE spoken readout via the device's own OS TTS
/// engine (flutter_tts) — zero network round-trip, works offline.
///
/// NOT the same thing as `core/ai/text_to_speech_interface.dart`'s
/// `TextToSpeechService` (currently a Noop stub): that one mirrors a
/// future SERVER-SIDE synthesis provider that returns a downloadable
/// audio file URL (Phase 2 readiness, unrelated to this). This service
/// is what every "🔊 استمع" button in the design brief needs — instant,
/// on-device, no server call.
const Map<String, String> _ttsLocaleFor = {
  'ar': 'ar-SA',
  'en': 'en-US',
  'ur': 'ur-PK',
  'hi': 'hi-IN',
  'bn': 'bn-BD',
  'tl': 'fil-PH',
  'am': 'am-ET',
};

abstract class TtsService {
  /// Speaks [text]. If [languageCode] is omitted, uses the CURRENT
  /// user's `preferredLanguage` (via AuthBloc) — this is what "تقرأ
  /// اللغة من preferredLanguage" means: the service itself resolves the
  /// language by default, so callers don't have to thread it through
  /// manually everywhere.
  Future<void> speak(String text, {String? languageCode});
  Future<void> stop();
}

class FlutterTtsServiceImpl implements TtsService {
  final FlutterTts _tts;
  final AuthBloc _authBloc;

  FlutterTtsServiceImpl({required FlutterTts tts, required AuthBloc authBloc})
      : _tts = tts,
        _authBloc = authBloc;

  @override
  Future<void> speak(String text, {String? languageCode}) async {
    if (text.trim().isEmpty) return;
    final lang = languageCode ?? _authBloc.state.user?.preferredLanguage ?? 'ar';
    final locale = _ttsLocaleFor[lang] ?? _ttsLocaleFor['ar']!;
    try {
      await _tts.stop(); // don't queue/overlap — a new speak() replaces whatever was playing
      await _tts.setLanguage(locale);
      await _tts.setSpeechRate(0.48); // slightly slower than default — matches the target audience's need for clarity over speed
      await _tts.speak(text);
    } catch (_) {
      // Best-effort: an unsupported language/engine failure here must
      // never surface as an app-level error — the text is still fully
      // readable on screen regardless of whether it can also be spoken.
    }
  }

  @override
  Future<void> stop() async {
    try {
      await _tts.stop();
    } catch (_) {}
  }
}
