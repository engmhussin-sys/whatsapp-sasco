// message_bubble.dart — دُمِج مع منطق حالة فشل تحويل الصوت إلى نص وزر
// إعادة المحاولة (A1، جلسة سابقة) بدل استبداله كليًا — القاعدة الحاكمة
// في design_handoff_atheel_community صريحة: "الكود هو الحقيقة عند
// التعارض، نفّذ الأقرب للنمط القائم وأبلِغ عن الفرق".
//
// القاعدة الحاكمة (لا تكسرها):
//   الترجمة = النص الأكبر، أعلى الفقاعة، 17sp / w600.
//   النص الأصلي يظهر **فقط** إذا اختلفت لغة المرسل عن لغة القارئ.

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/message_attachment_entity.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.message,
    required this.myLang,
    required this.isMine,
    this.onListen,
    this.onRetryTranscription,
    this.onRetrySend,
    this.showOriginalSetting = true,
    this.isGroupChat = true,
    this.isGroupedWithPrevious = false,
  });

  final MessageEntity message;

  /// لغة القارئ الحالي — من AuthBloc: currentUser.preferredLanguage
  final String myLang;

  final bool isMine;

  /// نطق النص المعروض — TtsService
  final VoidCallback? onListen;

  /// A1 (مراجعة ٥ أغسطس) — إعادة محاولة تحويل صوتي فشل.
  final VoidCallback? onRetryTranscription;

  /// CHAT_SPEC.md §1: علامة الفشل قابلة للنقر لإعادة الإرسال — لا وظيفة
  /// حتى يُبنى نمط الإرسال المتفائل الكامل (انظر message_entity.dart).
  final VoidCallback? onRetrySend;

  /// مفتاح المستخدم في «حسابي» لإظهار النص الأصلي
  final bool showOriginalSetting;

  /// CHAT_SPEC.md §1: "في المحادثة الفردية: لا اسم مرسِل إطلاقاً
  /// (تعرفه من الرأس)". افتراضي true لعدم كسر الاستدعاءات القديمة.
  final bool isGroupChat;

  /// CHAT_SPEC.md §1: هذه الرسالة من نفس مرسِل الرسالة السابقة خلال
  /// ٦٠ ثانية — تُخفي اسم المرسِل (حتى في المحادثة الجماعية)، تُقلِّل
  /// المسافة السفلية إلى 2dp، وتُزيل ذيل الفقاعة (زوايا 18dp كاملة).
  final bool isGroupedWithPrevious;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final l10n = MaterialLocalizations.of(context);

    final displayText = message.displayText(myLang);
    final isTranslated = message.isTranslatedFor(myLang);
    final translationMissing = message.translationMissingFor(myLang);
    final showOriginal = isTranslated && showOriginalSetting;

    // A1: حالة تحويل الصوت — لا تزال قيد المعالجة، أو فشلت صراحةً.
    final isTranscribing = message.type == MessageType.voice && (message.text == null || message.text!.isEmpty);
    final transcriptionFailed = message.text == 'تعذّر تحويل هذه الرسالة الصوتية إلى نص';

    final fg = isMine ? Colors.white : AppColors.textPrimary;
    final metaFg = isMine ? Colors.white70 : AppColors.textSecondary;
    final ruleColor = isMine ? Colors.white30 : AppColors.divider;

    return Padding(
      // CHAT_SPEC.md §1: "المسافة بين رسالتين: 2dp لنفس المرسِل · 8dp
      // عند تغيّر المرسِل". Gap.md=12 هنا يبقى الافتراضي غير المُجمَّع؛
      // 2dp فقط عند isGroupedWithPrevious.
      padding: EdgeInsets.only(bottom: isGroupedWithPrevious ? 2 : Gap.md),
      child: Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (isGroupChat && !isMine && !isGroupedWithPrevious) _SenderNameLabel(name: message.senderName),
          if (isGroupChat && !isMine && !isGroupedWithPrevious) const SizedBox(height: 2),
          Align(
            alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
                decoration: BoxDecoration(
                  color: isMine ? AppColors.brand : Colors.white,
                  borderRadius: R.bubbleR(isMine: isMine, isRtl: isRtl, hasTail: !isGroupedWithPrevious),
                  border: isMine ? null : Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ---- ٠ — مرفق صورة (المهمة ٧): كان غائبًا كليًا،
                    // وليس مجرد عرض أسود كما وُصِف — لم يوجد أي
                    // Image.network في مسار العرض إطلاقًا. ----
                    for (final attachment in message.attachments.where((a) => a.kind == MessageAttachmentKind.image)) ...[
                      _RetryableImage(url: attachment.url, metaFg: metaFg),
                      const SizedBox(height: Gap.sm),
                    ],
                    // ---- A1: حالة فشل صريحة (بدل الدوران الأبدي) ----
                    if (transcriptionFailed) ...[
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.error_outline_rounded, size: 14, color: isMine ? Colors.white70 : AppColors.accent),
                          const SizedBox(width: Gap.xs),
                          Text(
                            'chat.transcription_failed'.tr(),
                            style: TextStyle(fontSize: FS.caption, color: isMine ? Colors.white70 : AppColors.accent),
                          ),
                          if (onRetryTranscription != null) ...[
                            const SizedBox(width: Gap.sm),
                            GestureDetector(
                              onTap: onRetryTranscription,
                              child: Text(
                                'chat.retry'.tr(),
                                style: TextStyle(
                                  fontSize: FS.caption,
                                  fontWeight: FontWeight.w700,
                                  decoration: TextDecoration.underline,
                                  color: isMine ? Colors.white : AppColors.brand,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ] else if (isTranscribing) ...[
                      // ---- لا تزال قيد المعالجة ----
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 11,
                            height: 11,
                            child: CircularProgressIndicator(strokeWidth: 1.5, color: isMine ? Colors.white70 : AppColors.textSecondary),
                          ),
                          const SizedBox(width: Gap.xs),
                          Text(
                            'chat.transcribing'.tr(),
                            style: TextStyle(fontSize: FS.caption, color: isMine ? Colors.white70 : AppColors.textSecondary, fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    ] else ...[
                      // ١ — الترجمة + الصفّ السفلي (وقت + علامة تسليم)
                      // مُدمَجان: CHAT_SPEC.md §1 — واتساب يُدخل الميتا في
                      // نفس سطر النص إن اتسع، فلا يُهدر سطراً كاملاً في
                      // الرسائل القصيرة. Stack + مسافة شفافة بعرض الميتا
                      // في نهاية النص + الميتا الحقيقية مثبَّتة بالزاوية.
                      Stack(
                        children: [
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: displayText,
                                  style: TextStyle(
                                    fontFamily: fontFamilyFor(myLang),
                                    fontSize: FS.message,
                                    fontWeight: FontWeight.w600,
                                    height: 1.55,
                                    color: fg,
                                  ),
                                ),
                                WidgetSpan(
                                  alignment: PlaceholderAlignment.middle,
                                  child: SizedBox(width: _metaRowWidth(isMine)),
                                ),
                              ],
                            ),
                          ),
                          PositionedDirectional(
                            end: 0,
                            bottom: 0,
                            child: _MetaRow(
                              time: l10n.formatTimeOfDay(TimeOfDay.fromDateTime(message.createdAt)),
                              langCode: myLang,
                              isMine: isMine,
                              status: message.status,
                              metaFg: metaFg,
                              onRetrySend: onRetrySend,
                            ),
                          ),
                        ],
                      ),

                      // ٢ — النص الأصلي: فقط عند اختلاف اللغة
                      if (showOriginal) ...[
                        const SizedBox(height: Gap.sm),
                        _DashedRule(color: ruleColor),
                        const SizedBox(height: 7),
                        Text(
                          '${'chat.original'.tr()} · ${_langName(message.originalLang)}',
                          style: TextStyle(fontSize: FS.micro, letterSpacing: 0.4, color: metaFg),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          message.text ?? '',
                          style: TextStyle(fontFamily: fontFamilyFor(message.originalLang), fontSize: FS.small, height: 1.5, color: metaFg),
                        ),
                      ],

                      // ٣ — ترجمة مفقودة: نبلّغ ولا نصمت
                      if (translationMissing) ...[
                        const SizedBox(height: Gap.sm),
                        _MissingTranslationChip(label: 'chat.translation_failed'.tr(), isMine: isMine),
                      ],
                    ],

                    // ٤ — استمع (متاح دائمًا إن وُجد نص فعلي، بصرف النظر عن حالة التحويل)
                    if (onListen != null && !isTranscribing) ...[
                      const SizedBox(height: Gap.sm),
                      _ListenButton(label: 'chat.listen'.tr(), onTap: onListen!, isMine: isMine),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _langName(String code) => switch (code) {
        'ar' => 'العربية',
        'ur' => 'اردو',
        'hi' => 'हिन्दी',
        'bn' => 'বাংলা',
        'en' => 'English',
        'tl' => 'Tagalog',
        'am' => 'አማርኛ',
        _ => code.toUpperCase(),
      };
}

class _RetryableImage extends StatefulWidget {
  const _RetryableImage({required this.url, required this.metaFg});
  final String url;
  final Color metaFg;

  @override
  State<_RetryableImage> createState() => _RetryableImageState();
}

class _RetryableImageState extends State<_RetryableImage> {
  // المهمة ٥ (PROMPT_ROUND3.md): زر إعادة المحاولة صريح — تغيير المفتاح
  // يجبر Image.network على إعادة المحاولة بدل الاعتماد على ذاكرة تخزين
  // فاشلة. هذا لا يُصلح السبب الجذري (تخزين Railway المحلي غير الدائم —
  // انظر توثيق الجولة ٣)، لكنه يمنح المستخدم فرصة حقيقية بعد أي فشل
  // شبكي عابر لا علاقة له بذلك السبب.
  int _attempt = 0;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 220),
        child: Image.network(
          widget.url,
          key: ValueKey(_attempt),
          fit: BoxFit.cover,
          loadingBuilder: (context, child, progress) =>
              progress == null ? child : const SizedBox(height: 120, child: Center(child: CircularProgressIndicator())),
          errorBuilder: (context, error, stackTrace) => SizedBox(
            height: 100,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.broken_image_outlined, color: widget.metaFg),
                  const SizedBox(height: 4),
                  Text('chat.image_load_failed'.tr(), style: TextStyle(fontSize: FS.caption, color: widget.metaFg)),
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: () => setState(() => _attempt++),
                    child: Text(
                      'chat.retry'.tr(),
                      style: TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w700, decoration: TextDecoration.underline, color: widget.metaFg),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SenderNameLabel extends StatelessWidget {
  const _SenderNameLabel({required this.name});

  final String name;

  /// CHAT_SPEC.md §1: لون ثابت مشتقّ من هوية المرسل (الاسم هنا بدل
  /// senderId لعدم تمرير المعرّف الخام لهذه الودجة الصغيرة — الاسم
  /// كافٍ إحصائياً لتفادي تصادم بصري داخل نفس المحادثة الصغيرة).
  int get _colorIndex => name.codeUnits.fold(0, (sum, c) => sum + c) % AppColors.senderPalette.length;

  @override
  Widget build(BuildContext context) {
    return Text(name, style: TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w700, color: AppColors.senderPalette[_colorIndex]));
  }
}

/// CHAT_SPEC.md §1: الصفّ السفلي — الوقت + علامة تسليم (لرسائلي فقط).
class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.time,
    required this.langCode,
    required this.isMine,
    required this.status,
    required this.metaFg,
    this.onRetrySend,
  });

  final String time;
  final String langCode;
  final bool isMine;
  final MessageDeliveryStatus status;
  final Color metaFg;
  final VoidCallback? onRetrySend;

  @override
  Widget build(BuildContext context) {
    final failed = status == MessageDeliveryStatus.failed;
    return Padding(
      padding: const EdgeInsetsDirectional.only(top: 6),
      child: GestureDetector(
        onTap: failed ? onRetrySend : null,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              localizedDigits(time, langCode),
              style: TextStyle(fontSize: 11, color: failed ? AppColors.danger : metaFg),
            ),
            if (isMine) ...[
              const SizedBox(width: 3),
              _DeliveryIcon(status: status, metaFg: metaFg),
            ],
          ],
        ),
      ),
    );
  }
}

class _DeliveryIcon extends StatelessWidget {
  const _DeliveryIcon({required this.status, required this.metaFg});

  final MessageDeliveryStatus status;
  final Color metaFg;

  @override
  Widget build(BuildContext context) {
    switch (status) {
      case MessageDeliveryStatus.sending:
        return Icon(Icons.schedule, size: 12, color: metaFg);
      case MessageDeliveryStatus.sent:
        return Icon(Icons.done, size: 14, color: metaFg);
      case MessageDeliveryStatus.delivered:
        return Icon(Icons.done_all, size: 14, color: metaFg);
      case MessageDeliveryStatus.read:
        // CHAT_SPEC.md §1: أزرق واتساب الحرفي — استثناء وحيد مقصود عن
        // AppColors لأنه معيار تعرّف عالمي (نفس اللون الذي يعرفه كل
        // مستخدم واتساب لـ"قُرئت")، وليس اختياراً تصميمياً حراً.
        return const Icon(Icons.done_all, size: 14, color: Color(0xFF53BDEB));
      case MessageDeliveryStatus.failed:
        return const Icon(Icons.error_outline, size: 13, color: AppColors.danger);
    }
  }
}

/// عرض تقريبي لصفّ الميتا (وقت + علامة اختيارية) — يُستخدَم كمسافة
/// شفافة في نهاية النص الرئيسي حتى لا يتراكب معها في السطر الأخير.
double _metaRowWidth(bool isMine) => isMine ? 58 : 42;

/// الفاصل المتقطّع — ليس خطاً متصلاً وليس مسافة فارغة.
/// هذا التفصيل يميّز الترجمة عن الأصل بصرياً؛ لا تستبدله بـ Divider.
class _DashedRule extends StatelessWidget {
  const _DashedRule({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(height: 1, width: double.infinity, child: CustomPaint(painter: _DashedRulePainter(color)));
  }
}

class _DashedRulePainter extends CustomPainter {
  const _DashedRulePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dash = 4.0;
    const gap = 3.0;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    double x = 0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, 0), Offset(x + dash, 0), paint);
      x += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_DashedRulePainter old) => old.color != color;
}

class _ListenButton extends StatelessWidget {
  const _ListenButton({required this.label, required this.onTap, required this.isMine});

  final String label;
  final VoidCallback onTap;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final fg = isMine ? Colors.white : AppColors.brandDark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(R.pill),
      child: Container(
        constraints: const BoxConstraints(minHeight: Touch.min),
        padding: const EdgeInsets.symmetric(horizontal: Gap.md),
        alignment: AlignmentDirectional.centerStart,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.volume_up_rounded, size: 16, color: fg),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w600, color: fg)),
          ],
        ),
      ),
    );
  }
}

class _MissingTranslationChip extends StatelessWidget {
  const _MissingTranslationChip({required this.label, required this.isMine});

  final String label;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.sm, vertical: 5),
      decoration: BoxDecoration(
        color: isMine ? Colors.white24 : AppColors.accent.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(R.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.translate_rounded, size: 13, color: isMine ? Colors.white : AppColors.accent),
          const SizedBox(width: 5),
          Text(label, style: TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w600, color: isMine ? Colors.white : AppColors.accent)),
        ],
      ),
    );
  }
}
