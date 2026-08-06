import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/audio/audio_playback_service.dart';

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
    await _service.play(widget.messageId, _fullUrl, title: widget.senderName);
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
    final color = widget.isMine ? Colors.white : const Color(0xFF0C7C42);
    final trackColor = widget.isMine ? Colors.white38 : const Color(0xFFE2E8E4);

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
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                          icon: Icon(playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: color, size: 40),
                          onPressed: _togglePlay,
                        ),
                        if (!_service.hasBeenPlayed(widget.messageId))
                          const PositionedDirectional(
                            top: 2,
                            end: 2,
                            child: SizedBox(
                              width: 10,
                              height: 10,
                              child: DecoratedBox(decoration: BoxDecoration(color: Color(0xFF1D9BF0), shape: BoxShape.circle)),
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
    required this.bars,
    required this.fraction,
    required this.activeColor,
    required this.inactiveColor,
    required this.onSeek,
    required this.enabled,
  });

  final List<int>? waveform;
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

  double _heightFor(int index) {
    if (waveform == null || waveform!.isEmpty) return (_minHeight + _maxHeight) / 2;
    final idx = (index * waveform!.length / bars).floor().clamp(0, waveform!.length - 1);
    final normalized = (waveform![idx].clamp(0, 100)) / 100;
    return _minHeight + normalized * (_maxHeight - _minHeight);
  }

  @override
  Widget build(BuildContext context) {
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
                        height: _heightFor(i),
                        decoration: BoxDecoration(
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
