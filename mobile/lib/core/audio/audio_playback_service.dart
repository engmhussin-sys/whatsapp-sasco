import 'dart:async';
import 'package:just_audio/just_audio.dart';

/// CHAT_SPEC.md §3: "رسالة واحدة فقط تعمل في التطبيق كله" و"الاستمرار
/// خارج الشاشة: الصوت يكمل عند الخروج من المحادثة مع شريط تشغيل صغير
/// أعلى الشاشة". السبب الجذري لغياب كلا السلوكين: كل VoiceMessagePlayer
/// كانت تُنشئ AudioPlayer خاصاً بها معزولاً تماماً — لا مشاركة حالة، ولا
/// استمرارية عند إتلاف الودجة (dispose عند مغادرة الشاشة).
///
/// Singleton واحد (مُسجَّل في injection_container.dart) يحمل مشغّل صوت
/// واحد فعلي لكل التطبيق. أي VoiceMessagePlayer تستدعي play() تُوقِف
/// أي تشغيل سابق تلقائياً (نفس AudioPlayer يُعاد استخدامه، لا يُتلَف).
class AudioPlaybackService {
  final AudioPlayer _player = AudioPlayer();

  final _currentMessageIdController = StreamController<String?>.broadcast();
  String? _currentMessageId;
  String? _currentTitle;
  List<int>? _currentWaveform;
  List<int>? get currentWaveform => _currentWaveform;

  /// CHAT_SPEC.md §3: "نقطة غير مسموع... تختفي بعد أول استماع". مركزية
  /// هنا بدل حالة محلية لكل VoiceMessagePlayer — تلك كانت تُنسى عند
  /// مغادرة الشاشة والعودة إليها رغم أن الرسالة سُمِعت بالفعل.
  final Set<String> _playedMessageIds = {};
  bool hasBeenPlayed(String messageId) => _playedMessageIds.contains(messageId);

  /// معرّف الرسالة قيد التشغيل الآن حالياً، أو null إن لا شيء يعمل.
  Stream<String?> get currentMessageIdStream => _currentMessageIdController.stream;
  String? get currentMessageId => _currentMessageId;
  String? get currentTitle => _currentTitle;

  Stream<PlayerState> get playerStateStream => _player.playerStateStream;
  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Duration get position => _player.position;
  Duration? get duration => _player.duration;
  bool get isPlaying => _player.playing;

  /// يُشغِّل رسالة صوتية بمعرّف [messageId] — إن كانت رسالة مختلفة عن
  /// المُشغَّلة حالياً، يُوقِف الحالية أولاً تلقائياً (نفس المشغّل).
  /// [title] يُستخدَم في الشريط المصغّر (اسم المرسِل عادة).
  Future<void> play(String messageId, String url, {String? title, List<int>? waveform}) async {
    if (_currentMessageId != messageId) {
      await _player.setUrl(url);
      _currentMessageId = messageId;
      _currentTitle = title;
      _currentWaveform = waveform;
      _currentMessageIdController.add(messageId);
    }
    _playedMessageIds.add(messageId);
    await _player.play();
  }

  Future<void> pause() => _player.pause();

  /// استئناف تشغيل الرسالة النشطة حالياً (بعد pause) — بلا حاجة لتمرير
  /// رابط جديد، بخلاف play() التي تتوقع messageId/url رسالة قد تكون
  /// مختلفة عن المُشغَّلة حالياً.
  Future<void> resume() => _player.play();

  Future<void> seek(Duration position) => _player.seek(position);

  Future<void> stop() async {
    await _player.stop();
    _currentMessageId = null;
    _currentMessageIdController.add(null);
  }

  /// CHAT_SPEC.md §3: "تشغيل متسلسل: عند انتهاء رسالة صوتية تُشغَّل
  /// التالية تلقائياً إن كانت غير مسموعة ومن نفس المرسِل". يُسجَّل مرة
  /// واحدة عند تهيئة الخدمة؛ المستدعي (ChatBloc أو الصفحة) يُمرِّر
  /// دالة تحدد "الرسالة التالية" بحسب حالة المحادثة الحالية.
  StreamSubscription<PlayerState>? _completionSub;
  void onCompletion(Future<void> Function(String finishedMessageId) handler) {
    _completionSub?.cancel();
    _completionSub = _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed && _currentMessageId != null) {
        handler(_currentMessageId!);
      }
    });
  }

  /// يُستدعى من ChatPage.dispose() — يمنع معالِج مسجَّل من محادثة
  /// أُغلقت من الاستمرار في الاستماع ومحاولة الوصول لسياق تالف.
  void clearCompletion() {
    _completionSub?.cancel();
    _completionSub = null;
  }

  void dispose() {
    _completionSub?.cancel();
    _currentMessageIdController.close();
    _player.dispose();
  }
}
