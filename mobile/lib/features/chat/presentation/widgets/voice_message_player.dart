import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../../../core/constants/api_constants.dart';

/// Real audio playback (not a placeholder icon) using just_audio, pointed
/// at the backend's static /uploads path — the exact same URL structure
/// Message.audioUrl always resolves to (see backend main.ts's
/// app.useStaticAssets(... prefix: '/uploads')).
///
/// WhatsApp-style layout: circular play/pause button, a seekable
/// progress track the person can drag to scrub, and a duration label
/// that flips between "current position" while playing/paused-mid-way
/// and "total duration" when at the very start — matching exactly what
/// WhatsApp itself shows, not just an always-static total.
class VoiceMessagePlayer extends StatefulWidget {
  final String audioUrl;
  final bool isMine;
  /// The duration recorded at capture time and already stored server-side
  /// (Message.audioDurationMs) — shown immediately, before the player has
  /// lazily loaded the file on first tap. Without this, an unplayed clip
  /// shows "0:00" (nothing loaded yet) instead of its real length, exactly
  /// the bug a real user screenshot showed for two never-yet-tapped clips.
  final int? initialDurationMs;

  const VoiceMessagePlayer({super.key, required this.audioUrl, required this.isMine, this.initialDurationMs});

  @override
  State<VoiceMessagePlayer> createState() => _VoiceMessagePlayerState();
}

class _VoiceMessagePlayerState extends State<VoiceMessagePlayer> {
  late final AudioPlayer _player;
  bool _loaded = false;
  bool _loading = false;

  Duration get _initialDuration => Duration(milliseconds: widget.initialDurationMs ?? 0);

  String get _fullUrl {
    final origin = ApiConstants.baseUrl.replaceAll(RegExp(r'/api/v1$'), '');
    return widget.audioUrl.startsWith('http') ? widget.audioUrl : '$origin${widget.audioUrl}';
  }

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
  }

  Future<void> _togglePlay() async {
    if (!_loaded) {
      setState(() => _loading = true);
      try {
        await _player.setUrl(_fullUrl);
        _loaded = true;
      } catch (_) {
        // Playback stays unavailable for this message — the icon/slider
        // simply won't respond further; no crash, no silent retry loop.
        if (mounted) setState(() => _loading = false);
        return;
      }
      if (mounted) setState(() => _loading = false);
    }
    if (_player.playing) {
      await _player.pause();
    } else {
      // WhatsApp behavior: replay from the start once a clip has fully
      // finished, rather than doing nothing on a second tap.
      if (_player.position >= (_player.duration ?? Duration.zero) && (_player.duration ?? Duration.zero) > Duration.zero) {
        await _player.seek(Duration.zero);
      }
      await _player.play();
    }
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isMine ? Colors.white : Colors.black87;
    final trackColor = widget.isMine ? Colors.white24 : Colors.black12;

    return SizedBox(
      width: 220,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 36,
            height: 36,
            child: _loading
                ? Padding(
                    padding: const EdgeInsets.all(8),
                    child: CircularProgressIndicator(strokeWidth: 2, color: color),
                  )
                : StreamBuilder<PlayerState>(
                    stream: _player.playerStateStream,
                    builder: (context, snapshot) {
                      final playing = snapshot.data?.playing ?? false;
                      return IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: Icon(playing ? Icons.pause_circle_filled : Icons.play_circle_filled, color: color, size: 36),
                        onPressed: _togglePlay,
                      );
                    },
                  ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StreamBuilder<Duration?>(
                  stream: _player.durationStream,
                  builder: (context, durationSnapshot) {
                    final total = durationSnapshot.data ?? _initialDuration;
                    return StreamBuilder<Duration>(
                      stream: _player.positionStream,
                      builder: (context, positionSnapshot) {
                        final position = positionSnapshot.data ?? Duration.zero;
                        final maxMs = total.inMilliseconds > 0 ? total.inMilliseconds.toDouble() : 1.0;
                        final valueMs = position.inMilliseconds.toDouble().clamp(0.0, maxMs);
                        return SliderTheme(
                          data: SliderTheme.of(context).copyWith(
                            trackHeight: 3,
                            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                            overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                            activeTrackColor: color,
                            inactiveTrackColor: trackColor,
                            thumbColor: color,
                          ),
                          child: Slider(
                            value: valueMs,
                            max: maxMs,
                            onChanged: _loaded && total > Duration.zero ? (v) => _player.seek(Duration(milliseconds: v.round())) : null,
                          ),
                        );
                      },
                    );
                  },
                ),
                StreamBuilder<Duration?>(
                  stream: _player.durationStream,
                  builder: (context, durationSnapshot) {
                    final total = durationSnapshot.data ?? _initialDuration;
                    return StreamBuilder<Duration>(
                      stream: _player.positionStream,
                      builder: (context, positionSnapshot) {
                        final position = positionSnapshot.data ?? Duration.zero;
                        // Shows current position once playback has actually
                        // started moving; shows total duration beforehand —
                        // exactly WhatsApp's own convention, rather than
                        // always showing one or the other.
                        final label = position > Duration.zero ? _fmt(position) : _fmt(total);
                        return Padding(
                          padding: const EdgeInsetsDirectional.only(end: 4),
                          child: Text(label, style: TextStyle(color: color.withValues(alpha: 0.85), fontSize: 11)),
                        );
                      },
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}
