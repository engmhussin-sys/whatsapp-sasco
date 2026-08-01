import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import '../../../../core/constants/api_constants.dart';

/// Real audio playback (not a placeholder icon) using just_audio, pointed
/// at the backend's static /uploads path — the exact same URL structure
/// Message.audioUrl always resolves to (see backend main.ts's
/// app.useStaticAssets(... prefix: '/uploads')).
class VoiceMessagePlayer extends StatefulWidget {
  final String audioUrl;
  final bool isMine;

  const VoiceMessagePlayer({super.key, required this.audioUrl, required this.isMine});

  @override
  State<VoiceMessagePlayer> createState() => _VoiceMessagePlayerState();
}

class _VoiceMessagePlayerState extends State<VoiceMessagePlayer> {
  late final AudioPlayer _player;
  bool _loaded = false;

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
      await _player.setUrl(_fullUrl);
      setState(() => _loaded = true);
    }
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
    setState(() {});
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isMine ? Colors.white : Colors.black87;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
          icon: Icon(_player.playing ? Icons.pause_circle_filled : Icons.play_circle_filled, color: color, size: 32),
          onPressed: _togglePlay,
        ),
        const SizedBox(width: 8),
        StreamBuilder<Duration>(
          stream: _player.positionStream,
          builder: (context, snapshot) {
            final position = snapshot.data ?? Duration.zero;
            final total = _player.duration ?? Duration.zero;
            return Text(
              '${_fmt(position)} / ${_fmt(total)}',
              style: TextStyle(color: color, fontSize: 12),
            );
          },
        ),
      ],
    );
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}
