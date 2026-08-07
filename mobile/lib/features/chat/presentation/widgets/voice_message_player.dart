import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/injection_container.dart';
import '../../../../core/audio/audio_playback_service.dart';
import '../../../../core/theme/app_colors.dart';

/// REVIEW_ROUND7.md §7 — أُعيد بناؤها بالكامل من الصفر (لا ترقيع).
///
/// [VoiceMessageWidget] هي الودجة المرئية النقية المطلوبة حرفياً في §7-أ:
/// StatelessWidget بحتة، كل شيء يصلها كمعاملات جاهزة، بلا أي منطق حالة
/// أو شبكة بداخلها. [VoiceMessagePlayer] غلاف رفيع فوقها يربطها
/// بـ AudioPlaybackService (Singleton عالمي مُسجَّل في injection_container
/// — §7-د: مشغّل واحد للتطبيق كله، يوقف أي تشغيل آخر فوراً، ويُشغِّل
/// التالي غير المسموع من نفس المرسِل تلقائياً عند الانتهاء).
class VoiceMessageWidget extends StatelessWidget {
  static const int barCount = 45; // §7-ب: لا عدد أعمدة متغيّر — 45 دائماً

  final List<double> amplitudes; // §7-ج: محسوبة مسبقاً مرة واحدة، ليست هنا
  final double progress;
  final bool isPlaying;
  final bool isMine;
  final Duration remaining;
  final double speed;
  final bool everPlayed;
  final VoidCallback onPlayPause;
  final VoidCallback onSpeedTap;
  final ValueChanged<double> onSeek;

  const VoiceMessageWidget({
    super.key,
    required this.amplitudes,
    required this.progress,
    required this.isPlaying,
    required this.isMine,
    required this.remaining,
    required this.speed,
    required this.everPlayed,
    required this.onPlayPause,
    required this.onSpeedTap,
    required this.onSeek,
  });

  @override
  Widget build(BuildContext context) {
    // §7-ب: لا أي لون أزرق — played/remaining من AppColors أو Colors
    // الأساسية فقط، لا استثناء واحد.
    final played = isMine ? Colors.white : AppColors.brand;
    final remainingC = isMine ? Colors.white38 : AppColors.divider;

    return Row(
      children: [
        // ١ — زر التشغيل: دائرة 40dp
        GestureDetector(
          onTap: onPlayPause,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isMine ? Colors.white : AppColors.brandLight,
                ),
                child: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  size: 22,
                  color: AppColors.brand,
                ),
              ),
              // نقطة "غير مسموع" — أخضر العلامة، 6dp، لا أزرق. تختفي
              // بعد أول استماع (everPlayed تأتي من AudioPlaybackService
              // مركزياً — تبقى صحيحة حتى بعد مغادرة الشاشة والعودة).
              if (!everPlayed)
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
          ),
        ),
        const SizedBox(width: 10),

        // ٢ — الموجة: 45 عموداً ثابتة، سحب ونقر للتقديم
        Expanded(
          child: Builder(
            builder: (context) {
              return GestureDetector(
                onHorizontalDragUpdate: (d) {
                  final box = context.findRenderObject() as RenderBox?;
                  if (box == null) return;
                  onSeek((d.localPosition.dx / box.size.width).clamp(0.0, 1.0));
                },
                onTapUp: (d) {
                  final box = context.findRenderObject() as RenderBox?;
                  if (box == null) return;
                  onSeek((box.globalToLocal(d.globalPosition).dx / box.size.width).clamp(0.0, 1.0));
                },
                child: SizedBox(
                  height: 28,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: List.generate(
                      barCount,
                      (i) => Container(
                        width: 2,
                        height: 4 + amplitudes[i] * 20, // 4 → 24 dp
                        margin: const EdgeInsets.symmetric(horizontal: 1),
                        decoration: BoxDecoration(
                          color: (i / barCount) <= progress ? played : remainingC,
                          borderRadius: BorderRadius.circular(1),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(width: 10),

        // ٣ — المدة، أو السرعة أثناء التشغيل
        GestureDetector(
          onTap: isPlaying ? onSpeedTap : null,
          child: SizedBox(
            width: 42,
            child: Text(
              isPlaying ? '${speed == speed.roundToDouble() ? speed.round() : speed}x' : _fmt(remaining),
              style: TextStyle(
                fontSize: 11,
                fontWeight: isPlaying ? FontWeight.w700 : FontWeight.w400,
                color: isMine ? Colors.white70 : AppColors.textSecondary,
              ),
            ),
          ),
        ),
      ],
    );
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}

/// الغلاف الحي — يربط الودجة النقية أعلاه بـ AudioPlaybackService.
class VoiceMessagePlayer extends StatefulWidget {
  final String messageId;
  final String audioUrl;
  final bool isMine;
  final int? initialDurationMs;
  final List<double> amplitudes;
  final String? senderName;

  const VoiceMessagePlayer({
    super.key,
    required this.messageId,
    required this.audioUrl,
    required this.isMine,
    this.initialDurationMs,
    required this.amplitudes,
    this.senderName,
  });

  @override
  State<VoiceMessagePlayer> createState() => _VoiceMessagePlayerState();
}

class _VoiceMessagePlayerState extends State<VoiceMessagePlayer> {
  static const _speeds = [1.0, 1.5, 2.0];
  final _service = sl<AudioPlaybackService>();
  int _speedIndex = 0;

  Duration get _initialDuration => Duration(milliseconds: widget.initialDurationMs ?? 0);

  String get _fullUrl {
    final origin = ApiConstants.baseUrl.replaceAll(RegExp(r'/api/v1$'), '');
    return widget.audioUrl.startsWith('http') ? widget.audioUrl : '$origin${widget.audioUrl}';
  }

  Future<void> _togglePlay() async {
    final isActiveHere = _service.currentMessageId == widget.messageId;
    if (isActiveHere && _service.isPlaying) {
      await _service.pause();
      return;
    }
    // play() على الخدمة العالمية يوقف أي تشغيل آخر تلقائياً (§7-د).
    await _service.play(widget.messageId, _fullUrl, title: widget.senderName, waveform: widget.amplitudes.map((a) => (a * 100).round()).toList());
  }

  Future<void> _cycleSpeed() async {
    setState(() => _speedIndex = (_speedIndex + 1) % _speeds.length);
    await _service.setSpeed(_speeds[_speedIndex]);
  }

  Future<void> _seek(double fraction) async {
    final isActiveHere = _service.currentMessageId == widget.messageId;
    if (!isActiveHere) return;
    final total = _service.duration ?? _initialDuration;
    if (total <= Duration.zero) return;
    await _service.seek(Duration(milliseconds: (total.inMilliseconds * fraction).round()));
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<String?>(
      stream: _service.currentMessageIdStream,
      initialData: _service.currentMessageId,
      builder: (context, activeSnap) {
        final isActiveHere = activeSnap.data == widget.messageId;
        return StreamBuilder<PlayerState>(
          stream: isActiveHere ? _service.playerStateStream : Stream<PlayerState>.empty(),
          builder: (context, stateSnap) {
            final playing = isActiveHere && (stateSnap.data != null && _service.isVisuallyPlaying(stateSnap.data!));
            return StreamBuilder<Duration>(
              stream: isActiveHere ? _service.positionStream : Stream<Duration>.empty(),
              builder: (context, posSnap) {
                final position = isActiveHere ? (posSnap.data ?? Duration.zero) : Duration.zero;
                return StreamBuilder<Duration?>(
                  stream: isActiveHere ? _service.durationStream : Stream<Duration?>.empty(),
                  builder: (context, durSnap) {
                    final total = isActiveHere ? (durSnap.data ?? _initialDuration) : _initialDuration;
                    final progress = total.inMilliseconds > 0 ? (position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0) : 0.0;
                    final remaining = position > Duration.zero ? total - position : total;
                    return VoiceMessageWidget(
                      amplitudes: widget.amplitudes,
                      progress: progress,
                      isPlaying: playing,
                      isMine: widget.isMine,
                      remaining: remaining,
                      speed: _speeds[_speedIndex],
                      everPlayed: _service.hasBeenPlayed(widget.messageId),
                      onPlayPause: _togglePlay,
                      onSpeedTap: _cycleSpeed,
                      onSeek: _seek,
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }
}
