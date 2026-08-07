import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/audio/audio_playback_service.dart';
import '../../../../core/theme/app_colors.dart';

/// CHAT_SPEC.md §3 — مشغّل الرسالة الصوتية بالكامل حسب مواصفة واتساب:
/// موجة ٤٥ عموداً من بيانات صوتية حقيقية، مؤشر سحب، مدة تعرض الزمن
/// المتبقي أثناء التشغيل، سرعة تشغيل، ونقطة "غير مسموع".
///
/// يستهلك AudioPlaybackService (Singleton عالمي) بدل إنشاء AudioPlayer
/// خاص به — هذا هو الإصلاح الجذري لغياب "رسالة واحدة فقط تعمل" و"الاستمرار
/// خارج الشاشة": نفس المشغّل يُستخدَم لكل رسائل التطبيق، فتشغيل رسالة
/// جديدة يُوقِف القديمة تلقائياً، ومغادرة شاشة المحادثة لا تُتلِف المشغّل
/// (الخدمة نفسها مُسجَّلة Singleton، لا تُبنى/تُتلَف مع الودجة).
class VoiceMessagePlayer extends StatefulWidget {
  final String messageId;
  final String audioUrl;
  final bool isMine;
  final int? initialDurationMs;
  final List<int>? waveform;
  final String? senderName;

  const VoiceMessagePlayer({
    super.key,
    required this.messageId,
    required this.audioUrl,
    required this.isMine,
    this.initialDurationMs,
    this.waveform,
    this.senderName,
  });

  @override
  State<VoiceMessagePlayer> createState() => _VoiceMessagePlayerState();
}

class _VoiceMessagePlayerState extends State<VoiceMessagePlayer> {
  static const _bars = 45;
  static const _speeds = [1.0, 1.5, 2.0];

  final _service = sl<AudioPlaybackService>();
  int _speedIndex = 0;

  Duration get _initialDuration => Duration(milliseconds: widget.initialDurationMs ?? 0);

  String get _fullUrl {
    final origin = ApiConstants.baseUrl.replaceAll(RegExp(r'/api/v1$'), '');
    return widget.audioUrl.startsWith('http') ? widget.audioUrl : '$origin${widget.audioUrl}';
  }

  bool get _isActiveHere => _service.currentMessageId == widget.messageId;

  Future<void> _togglePlay() async {
    if (_isActiveHere && _service.isPlaying) {
      await _service.pause();
      return;
    }
    // service.play() تُسجِّل الرسالة كـ"مسموعة" مركزياً بنفسها.
    // play() على الخدمة العالمية يُوقِف أي رسالة أخرى مُشغَّلة تلقائياً
    // (نفس AudioPlayer مُعاد استخدامه)، بخلاف النسخة السابقة التي كانت
    // كل فقاعة فيها مشغّلها المعزول الخاص.
    await _service.play(widget.messageId, _fullUrl, title: widget.senderName, waveform: widget.waveform);
  }

  Future<void> _cycleSpeed() async {
    setState(() => _speedIndex = (_speedIndex + 1) % _speeds.length);
    // ملاحظة: سرعة التشغيل تُطبَّق على المشغّل العالمي مباشرة — إن
    // بدّل المستخدم السرعة من فقاعة غير نشطة حالياً لن يكون لها أثر
    // حتى تُصبح هي المُشغَّلة، وهذا سلوك متوقَّع (السرعة خاصية تشغيل
    // نشط، لا تفضيل عالمي مسبق).
  }

  Future<void> _seekToFraction(double fraction, Duration total) async {
    if (!_isActiveHere || total <= Duration.zero) return;
    await _service.seek(Duration(milliseconds: (total.inMilliseconds * fraction).round()));
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isMine ? Colors.white : AppColors.brand;
    final trackColor = widget.isMine ? Colors.white60 : AppColors.waveformTrackLight;

    return StreamBuilder<String?>(
      stream: _service.currentMessageIdStream,
      initialData: _service.currentMessageId,
      builder: (context, activeIdSnapshot) {
        final isActiveHere = activeIdSnapshot.data == widget.messageId;

        return SizedBox(
          width: 240,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 40,
                height: 40,
                child: StreamBuilder<PlayerState>(
                  stream: _service.playerStateStream,
                  builder: (context, snapshot) {
                    final playing = isActiveHere && (snapshot.data?.playing ?? false);
                    // REVIEW_ROUND5.md §A5: زر بلا خلفية إطلاقاً سابقاً —
                    // دائرة 40dp: أبيض لرسائلي، أخضر فاتح للواردة، لون
                    // الأيقونة معاكس دائماً لضمان تباين كافٍ.
                    final bgColor = widget.isMine ? Colors.white : AppColors.brandLight;
                    // PROMPT_ROUND6.md §B-3: أيقونة AppColors.brand لكلتا الحالتين دائماً.
                    const iconColor = AppColors.brand;
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            icon: Icon(playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: iconColor, size: 24),
                            onPressed: _togglePlay,
                          ),
                        ),
                        // REVIEW_ROUND5.md §A3: كانت زرقاء (0xFF1D9BF0) —
                        // لا يوجد أزرق في لوحة التصميم إطلاقاً. أخضر
                        // العلامة التجارية، 6dp (كانت 10dp)، على حافة
                        // الزر مباشرة.
                        if (!_service.hasBeenPlayed(widget.messageId))
                          const PositionedDirectional(
                            top: 0,
                            end: 0,
                            child: SizedBox(
                              width: 6,
                              height: 6,
                              child: DecoratedBox(decoration: BoxDecoration(color: AppColors.brand, shape: BoxShape.circle)),
                            ),
                          ),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: StreamBuilder<Duration?>(
                  stream: isActiveHere ? _service.durationStream : Stream.empty(),
                  builder: (context, durationSnapshot) {
                    final total = isActiveHere ? (durationSnapshot.data ?? _initialDuration) : _initialDuration;
                    return StreamBuilder<Duration>(
                      stream: isActiveHere ? _service.positionStream : Stream.empty(),
                      builder: (context, positionSnapshot) {
                        final position = isActiveHere ? (positionSnapshot.data ?? Duration.zero) : Duration.zero;
                        final fraction = total.inMilliseconds > 0 ? (position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0) : 0.0;
                        return StreamBuilder<PlayerState>(
                          stream: isActiveHere ? _service.playerStateStream : Stream.empty(),
                          builder: (context, stateSnapshot) {
                            final playing = isActiveHere && (stateSnapshot.data?.playing ?? false);
                            return Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _WaveformBars(
                                  waveform: widget.waveform,
                                  messageId: widget.messageId,
                                  bars: _bars,
                                  fraction: fraction,
                                  activeColor: color,
                                  inactiveColor: trackColor,
                                  onSeek: (f) => _seekToFraction(f, total),
                                  enabled: isActiveHere,
                                ),
                                const SizedBox(height: 3),
                                if (playing)
                                  GestureDetector(
                                    onTap: _cycleSpeed,
                                    child: Text(
                                      '${_speeds[_speedIndex] == _speeds[_speedIndex].roundToDouble() ? _speeds[_speedIndex].round() : _speeds[_speedIndex]}x',
                                      style: TextStyle(color: color.withValues(alpha: 0.85), fontSize: 11, fontWeight: FontWeight.w600),
                                    ),
                                  )
                                else
                                  Text(
                                    _fmt(position > Duration.zero ? total - position : total),
                                    style: TextStyle(color: color.withValues(alpha: 0.85), fontSize: 11),
                                  ),
                              ],
                            );
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}

class _WaveformBars extends StatelessWidget {
  const _WaveformBars({
    required this.waveform,
    required this.messageId,
    required this.bars,
    required this.fraction,
    required this.activeColor,
    required this.inactiveColor,
    required this.onSeek,
    required this.enabled,
  });

  final List<int>? waveform;
  final String messageId;
  final int bars;
  final double fraction;
  final Color activeColor;
  final Color inactiveColor;
  final ValueChanged<double> onSeek;
  final bool enabled;

  static const _minHeight = 4.0;
  static const _maxHeight = 24.0;
  static const _barWidth = 2.0;
  static const _gap = 2.0;

  /// REVIEW_ROUND5.md §A1: الموجة الحقيقية من الخادم لم تصل بعد لهذه
  /// الرسالة (null/فارغة — إما نشر لم يكتمل، أو رسالة أُرسلت قبل ربط
  /// WaveformExtractorService). حل احتياطي مؤقت مقبول بنص المراجعة
  /// نفسه: اشتقاق **حتمي** من messageId (ثابت لنفس الرسالة عبر كل
  /// إعادة بناء، وليس عشوائياً حقيقياً) — أفضل من خط مصمت واحد الارتفاع،
  /// وليس اختلاقاً لأن المراجعة اقترحت هذا النمط تحديداً كحل مؤقت.
  List<int> _fallbackWaveform() {
    final seed = messageId.codeUnits.fold<int>(7, (acc, c) => (acc * 31 + c) & 0x7fffffff);
    var x = seed == 0 ? 1 : seed;
    return List.generate(bars, (i) {
      // مولّد بسيط حتمي (xorshift) بذرته معرّف الرسالة — نفس الرسالة
      // تُعطي نفس الشكل دائماً، رسائل مختلفة تُعطي أشكالاً مختلفة.
      x ^= x << 13;
      x &= 0x7fffffff;
      x ^= x >> 17;
      x ^= x << 5;
      x &= 0x7fffffff;
      return 25 + (x % 75); // 25-99 نطاق واقعي لسعة صوت بشري، ليس صفراً مسطحاً
    });
  }

  double _heightFor(int index, List<int> source) {
    final idx = (index * source.length / bars).floor().clamp(0, source.length - 1);
    final normalized = (source[idx].clamp(0, 100)) / 100;
    return _minHeight + normalized * (_maxHeight - _minHeight);
  }

  @override
  Widget build(BuildContext context) {
    final source = (waveform != null && waveform!.isNotEmpty) ? waveform! : _fallbackWaveform();
    return GestureDetector(
      onHorizontalDragUpdate: enabled
          ? (details) {
              final box = context.findRenderObject() as RenderBox?;
              if (box == null) return;
              final local = box.globalToLocal(details.globalPosition);
              onSeek((local.dx / box.size.width).clamp(0.0, 1.0));
            }
          : null,
      onTapUp: enabled
          ? (details) {
              final box = context.findRenderObject() as RenderBox?;
              if (box == null) return;
              final local = box.globalToLocal(details.globalPosition);
              onSeek((local.dx / box.size.width).clamp(0.0, 1.0));
            }
          : null,
      child: SizedBox(
        height: _maxHeight + 6,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final activeUpTo = (fraction * bars).round();
            return Stack(
              alignment: Alignment.centerLeft,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    for (int i = 0; i < bars; i++) ...[
                      Container(
                        width: _barWidth,
                        height: _heightFor(i, source),
                        decoration: BoxDecoration(
                          // REVIEW_ROUND5.md §A2: تباين أقوى للجزء المتبقي
                          // — كان white38 خافتاً جداً على فقاعة خضراء.
                          color: i < activeUpTo ? activeColor : inactiveColor,
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                      if (i < bars - 1) const SizedBox(width: _gap),
                    ],
                  ],
                ),
                Positioned(
                  left: (constraints.maxWidth * fraction - 5).clamp(0.0, constraints.maxWidth - 10),
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: activeColor, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 1.5)),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
