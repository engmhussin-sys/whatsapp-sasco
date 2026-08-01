import 'dart:async';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';

/// Real microphone recording (not a placeholder) using package:record.
/// Records to a local .m4a file, then hands the file path + measured
/// duration back to the caller (ChatPage) to upload via
/// ChatBloc.add(ChatVoiceMessageSent(...)).
class VoiceRecorderButton extends StatefulWidget {
  final void Function(String filePath, int durationMs) onRecorded;

  const VoiceRecorderButton({super.key, required this.onRecorded});

  @override
  State<VoiceRecorderButton> createState() => _VoiceRecorderButtonState();
}

class _VoiceRecorderButtonState extends State<VoiceRecorderButton> {
  final _recorder = AudioRecorder();
  bool _isRecording = false;
  DateTime? _startedAt;
  Timer? _tick;
  Duration _elapsed = Duration.zero;

  Future<void> _start() async {
    if (!await _recorder.hasPermission()) return;
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/${const Uuid().v4()}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    _startedAt = DateTime.now();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _elapsed = DateTime.now().difference(_startedAt!));
    });
    setState(() => _isRecording = true);
  }

  Future<void> _stop() async {
    final path = await _recorder.stop();
    _tick?.cancel();
    final durationMs = _startedAt != null ? DateTime.now().difference(_startedAt!).inMilliseconds : 0;
    setState(() {
      _isRecording = false;
      _elapsed = Duration.zero;
    });
    if (path != null) widget.onRecorded(path, durationMs);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_isRecording)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Text(
              '${_elapsed.inMinutes}:${(_elapsed.inSeconds % 60).toString().padLeft(2, '0')}',
              style: const TextStyle(color: Colors.red),
            ),
          ),
        IconButton(
          icon: Icon(_isRecording ? Icons.stop_circle : Icons.mic, color: _isRecording ? Colors.red : Colors.grey.shade600, size: 28),
          onPressed: _isRecording ? _stop : _start,
        ),
      ],
    );
  }
}
