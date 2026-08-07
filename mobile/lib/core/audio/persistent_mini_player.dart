import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:just_audio/just_audio.dart';
import '../di/injection_container.dart';
import 'audio_playback_service.dart';

/// CHAT_SPEC.md §3: "الاستمرار خارج الشاشة: الصوت يكمل عند الخروج من
/// المحادثة مع شريط تشغيل صغير أعلى الشاشة". يُغلَّف حول كل شاشات
/// التطبيق (App.builder في app.dart) — يظهر تلقائياً أينما كان
/// المستخدم متى ما كان هناك تشغيل نشط، ويختفي تماماً غير ذلك.
///
/// حدّ صادق: يظهر أيضاً أثناء وجود المستخدم داخل شاشة المحادثة نفسها
/// (حيث الفقاعة تعرض تفاصيل مطابقة) — إخفاؤه تحديداً هناك فقط يحتاج
/// معرفة الشاشة الحالية عبر GoRouter، وهو تعقيد إضافي لم أُضِفه هنا.
/// ازدواجية بصرية بسيطة، لا خطأ وظيفي.
class PersistentMiniPlayer extends StatelessWidget {
  const PersistentMiniPlayer({super.key, required this.child});

  final Widget child;

  static const _barHeight = 52.0;

  @override
  Widget build(BuildContext context) {
    final service = sl<AudioPlaybackService>();
    return StreamBuilder<String?>(
      stream: service.currentMessageIdStream,
      initialData: service.currentMessageId,
      builder: (context, snapshot) {
        final active = snapshot.data != null;
        final mq = MediaQuery.of(context);
        return Stack(
          children: [
            // REVIEW_ROUND5.md §C3: كان الشريط يطفو فوق المحتوى عبر
            // Stack+Positioned بلا أي تعديل لمساحة المحتوى نفسه — يُغطّي
            // رأس المحادثة وأول صف بقائمة المحادثات. الآن: عند نشاط
            // الشريط، MediaQuery المُمرَّرة لبقية الشجرة تحمل padding
            // علوياً إضافياً بارتفاع الشريط، فتدفعه كل SafeArea/Scaffold
            // داخلي تلقائياً لأسفل الشريط بدل رسمه فوق المحتوى.
            MediaQuery(
              data: active ? mq.copyWith(padding: mq.padding.copyWith(top: mq.padding.top + _barHeight)) : mq,
              child: child,
            ),
            if (active)
              PositionedDirectional(
                top: mq.padding.top,
                start: 0,
                end: 0,
                child: Material(
                  elevation: 4,
                  color: const Color(0xFF11201A),
                  child: SizedBox(
                    height: _barHeight,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          StreamBuilder<PlayerState>(
                            stream: service.playerStateStream,
                            builder: (context, stateSnapshot) {
                              final playing = stateSnapshot.data?.playing ?? false;
                              return IconButton(
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                icon: Icon(playing ? Icons.pause_circle_filled : Icons.play_circle_filled, color: Colors.white, size: 30),
                                onPressed: () => playing ? service.pause() : service.resume(),
                              );
                            },
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  service.currentTitle ?? 'chat.voice_message'.tr(),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 3),
                                // REVIEW_ROUND5.md §C3: إثراء — موجة مصغّرة
                                // + الزمن المتبقي، لا الاسم فقط.
                                StreamBuilder<Duration?>(
                                  stream: service.durationStream,
                                  builder: (context, durationSnapshot) {
                                    final total = durationSnapshot.data ?? Duration.zero;
                                    return StreamBuilder<Duration>(
                                      stream: service.positionStream,
                                      builder: (context, positionSnapshot) {
                                        final position = positionSnapshot.data ?? Duration.zero;
                                        final fraction = total.inMilliseconds > 0 ? (position.inMilliseconds / total.inMilliseconds).clamp(0.0, 1.0) : 0.0;
                                        final remaining = position > Duration.zero ? total - position : total;
                                        return Row(
                                          children: [
                                            Expanded(child: _MiniWaveform(waveform: service.currentWaveform, fraction: fraction)),
                                            const SizedBox(width: 6),
                                            Text(
                                              '${remaining.inMinutes}:${(remaining.inSeconds % 60).toString().padLeft(2, '0')}',
                                              style: const TextStyle(color: Colors.white70, fontSize: 10),
                                            ),
                                          ],
                                        );
                                      },
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            icon: const Icon(Icons.close, color: Colors.white70, size: 20),
                            onPressed: () => service.stop(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// نسخة مصغّرة جداً من موجة الصوت — 20 عمود ثابتة بدل 45، بلا سحب،
/// فقط عرض بصري لتقدّم التشغيل ضمن مساحة الشريط الضيقة.
class _MiniWaveform extends StatelessWidget {
  const _MiniWaveform({required this.waveform, required this.fraction});
  final List<int>? waveform;
  final double fraction;
  static const _bars = 20;

  @override
  Widget build(BuildContext context) {
    final activeUpTo = (fraction * _bars).round();
    return SizedBox(
      height: 10,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (int i = 0; i < _bars; i++) ...[
            Container(
              width: 2,
              height: waveform == null || waveform!.isEmpty
                  ? 6
                  : 2 + ((waveform![(i * waveform!.length / _bars).floor().clamp(0, waveform!.length - 1)].clamp(0, 100)) / 100) * 8,
              decoration: BoxDecoration(
                color: i < activeUpTo ? Colors.white : Colors.white24,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
            if (i < _bars - 1) const SizedBox(width: 1.5),
          ],
        ],
      ),
    );
  }
}
