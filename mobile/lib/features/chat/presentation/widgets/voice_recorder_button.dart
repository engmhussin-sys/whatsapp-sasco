import 'dart:async';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';

/// REVIEW_ROUND7.md §7-و — أُعيد بناؤها بالكامل من الصفر (كان مجرد
/// نقرة تبدأ/توقف بعدَّاد نصي فقط). الآن: ضغط مطوّل يبدأ التسجيل، موجة
/// حيّة من مستوى الصوت الفعلي، سحب باتجاه بداية السطر (يمين في RTL)
/// يُلغي، سحب لأعلى يُثبِّت التسجيل (قفل)، رفع الإصبع بلا إلغاء يُرسِل.
class VoiceRecorderButton extends StatefulWidget {
  final void Function(String filePath, int durationMs) onRecorded;
  /// REVIEW_ROUND7.md §7-و: الودجة الآن تملأ العرض الكامل أثناء التسجيل
  /// (موجة حيّة + عدَّاد + سحب للإلغاء) — يجب على المستدعي إخفاء باقي
  /// عناصر شريط الإدخال (المرفق، حقل النص، زر الإرسال) في هذه الحالة.
  final ValueChanged<bool>? onRecordingChanged;

  const VoiceRecorderButton({super.key, required this.onRecorded, this.onRecordingChanged});

  @override
  State<VoiceRecorderButton> createState() => _VoiceRecorderButtonState();
}

enum _RecordPhase { idle, recording, locked }

class _VoiceRecorderButtonState extends State<VoiceRecorderButton> {
  static const _cancelThreshold = 80.0; // dp سحب نحو بداية السطر لإلغاء
  static const _lockThreshold = 60.0; // dp سحب لأعلى لتثبيت التسجيل

  final _recorder = AudioRecorder();
  _RecordPhase _phase = _RecordPhase.idle;
  DateTime? _startedAt;
  Timer? _tick;
  Duration _elapsed = Duration.zero;
  String? _currentPath;

  // موضع السحب الحالي بالنسبة لنقطة البداية — يُستخدَم لكل من مؤشر
  // الإلغاء المتلاشي وتفعيل القفل.
  Offset _dragDelta = Offset.zero;
  bool _willCancel = false;

  StreamSubscription<Amplitude>? _amplitudeSub;
  // آخر 30 قيمة سعة صوت حقيقية — تُرسَم كموجة حيّة أثناء التسجيل نفسه
  // (مختلفة عن VoiceMessageWidget التي تعرض موجة رسالة مكتملة).
  final List<double> _liveAmplitudes = [];

  Future<void> _startRecording() async {
    // BUG FIX (confirmed real report: "لا يستجيب نهائياً" on long-press):
    // a denied/not-yet-granted microphone permission made this return
    // completely silently — no snackbar, no dialog, nothing — which
    // looks EXACTLY like the button doing nothing at all. hasPermission()
    // itself triggers the OS permission prompt on first use; if the
    // person denies it (or denied it previously), this now tells them
    // clearly instead of failing invisibly.
    final granted = await _recorder.hasPermission();
    if (!granted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('chat.mic_permission_denied'.tr()), backgroundColor: AppColors.danger),
        );
      }
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
    final path = '${dir.path}/${const Uuid().v4()}.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    _currentPath = path;
    _startedAt = DateTime.now();
    _liveAmplitudes.clear();
    _dragDelta = Offset.zero;
    _willCancel = false;

    _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted || _startedAt == null) return;
      setState(() => _elapsed = DateTime.now().difference(_startedAt!));
    });

    // REVIEW_ROUND7.md §7-و: موجة حيّة من مستوى الصوت الفعلي أثناء
    // التسجيل — ليست زخرفة، بل انعكاس حقيقي لصوت المستخدم الآن.
    _amplitudeSub = _recorder.onAmplitudeChanged(const Duration(milliseconds: 150)).listen((amp) {
      if (!mounted) return;
      // amp.current بالديسيبل، عادة -160 (صمت) حتى 0 (أعلى صوت) —
      // تطبيع لنطاق 0.0-1.0 لعرضها كأعمدة موجة بنفس منطق VoiceMessageWidget.
      final normalized = ((amp.current + 60) / 60).clamp(0.0, 1.0);
      setState(() {
        _liveAmplitudes.add(normalized);
        if (_liveAmplitudes.length > 30) _liveAmplitudes.removeAt(0);
      });
    });

    setState(() => _phase = _RecordPhase.recording);
    widget.onRecordingChanged?.call(true);
    } catch (e) {
      // فشل بدء التسجيل لأي سبب تقني آخر (تعذّر الوصول للميكروفون
      // فعلياً رغم منح الإذن، مساحة تخزين ممتلئة، إلخ) — كان يفشل
      // بصمت تام سابقاً بلا try/catch على الإطلاق حول هذه الدالة.
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('chat.recording_start_failed'.tr()), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  Future<void> _finishRecording({required bool send}) async {
    final path = await _recorder.stop();
    _tick?.cancel();
    _amplitudeSub?.cancel();
    final durationMs = _startedAt != null ? DateTime.now().difference(_startedAt!).inMilliseconds : 0;
    setState(() {
      _phase = _RecordPhase.idle;
      _elapsed = Duration.zero;
      _liveAmplitudes.clear();
      _dragDelta = Offset.zero;
      _willCancel = false;
    });
    if (send && path != null) {
      widget.onRecorded(path, durationMs);
    }
    widget.onRecordingChanged?.call(false);
    // إلغاء: الملف يبقى على القرص المؤقت بلا رفع — سيُحذَف تلقائياً
    // مع تنظيف نظام التشغيل الدوري لمجلد temp، لا حاجة لحذف يدوي فوري.
    _currentPath = null;
  }

  void _onLongPressStart(LongPressStartDetails details) {
    _startRecording();
  }

  void _onLongPressMoveUpdate(LongPressMoveUpdateDetails details) {
    if (_phase != _RecordPhase.recording) return;
    setState(() {
      _dragDelta = details.offsetFromOrigin;
      // بداية السطر في RTL = يمين = dx موجب.
      _willCancel = _dragDelta.dx > _cancelThreshold;
    });
    if (-_dragDelta.dy > _lockThreshold && !_willCancel) {
      setState(() => _phase = _RecordPhase.locked);
    }
  }

  void _onLongPressEnd(LongPressEndDetails details) {
    if (_phase != _RecordPhase.recording) return; // locked يُنهى بزر منفصل، لا برفع الإصبع
    _finishRecording(send: !_willCancel);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _amplitudeSub?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  String _fmt(Duration d) => '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    if (_phase == _RecordPhase.idle) {
      return GestureDetector(
        onLongPressStart: _onLongPressStart,
        onLongPressMoveUpdate: _onLongPressMoveUpdate,
        onLongPressEnd: _onLongPressEnd,
        child: const Padding(
          padding: EdgeInsets.all(8),
          child: Icon(Icons.mic, color: AppColors.textSecondary, size: 26),
        ),
      );
    }

    // أثناء التسجيل أو القفل: شريط كامل العرض يستبدل باقي عناصر الإدخال
    // (يُعرَض فوقها عبر Positioned من مستوى المستدعي — انظر chat_page.dart).
    final cancelOpacity = _willCancel ? 1.0 : (1.0 - (_dragDelta.dx.abs() / _cancelThreshold)).clamp(0.3, 1.0);

    return GestureDetector(
      onLongPressMoveUpdate: _phase == _RecordPhase.recording ? _onLongPressMoveUpdate : null,
      onLongPressEnd: _phase == _RecordPhase.recording ? _onLongPressEnd : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: AppColors.surfaceLight, borderRadius: BorderRadius.circular(24)),
        child: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: const BoxDecoration(color: AppColors.danger, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(_fmt(_elapsed), style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(width: 10),
            Expanded(
              child: _phase == _RecordPhase.locked
                  ? _LiveWaveform(amplitudes: _liveAmplitudes)
                  : Opacity(
                      opacity: cancelOpacity,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.textSecondary),
                          Text(
                            _willCancel ? 'chat.release_to_cancel'.tr() : 'chat.slide_to_cancel'.tr(),
                            style: TextStyle(
                              fontSize: FS.caption,
                              color: _willCancel ? AppColors.danger : AppColors.textSecondary,
                              fontWeight: _willCancel ? FontWeight.w700 : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            if (_phase == _RecordPhase.locked) ...[
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: AppColors.textSecondary),
                onPressed: () => _finishRecording(send: false),
              ),
              IconButton(
                icon: const Icon(Icons.send_rounded, color: AppColors.brand),
                onPressed: () => _finishRecording(send: true),
              ),
            ] else
              const Icon(Icons.lock_outline_rounded, color: AppColors.textSecondary, size: 20),
          ],
        ),
      ),
    );
  }
}

/// موجة حيّة أثناء التسجيل نفسه (وليس رسالة مكتملة) — تنمو من اليمين
/// (بداية السطر RTL) كل قيمة سعة صوت جديدة تصل.
class _LiveWaveform extends StatelessWidget {
  const _LiveWaveform({required this.amplitudes});
  final List<double> amplitudes;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 24,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          for (final a in amplitudes) ...[
            Container(
              width: 2,
              height: 4 + a * 20,
              decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(1)),
            ),
            const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }
}
