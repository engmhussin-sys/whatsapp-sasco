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

  @override
  Widget build(BuildContext context) {
    final service = sl<AudioPlaybackService>();
    return Stack(
      children: [
        child,
        StreamBuilder<String?>(
          stream: service.currentMessageIdStream,
          initialData: service.currentMessageId,
          builder: (context, snapshot) {
            if (snapshot.data == null) return const SizedBox.shrink();
            return PositionedDirectional(
              top: MediaQuery.of(context).padding.top + 4,
              start: 12,
              end: 12,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(14),
                color: const Color(0xFF11201A),
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
                        child: Text(
                          service.currentTitle ?? 'chat.voice_message'.tr(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
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
            );
          },
        ),
      ],
    );
  }
}
