// message_bubble.dart — دُمِج مع منطق حالة فشل تحويل الصوت إلى نص وزر
// إعادة المحاولة (A1، جلسة سابقة) بدل استبداله كليًا — القاعدة الحاكمة
// في design_handoff_atheel_community صريحة: "الكود هو الحقيقة عند
// التعارض، نفّذ الأقرب للنمط القائم وأبلِغ عن الفرق".
//
// القاعدة الحاكمة (لا تكسرها):
//   الترجمة = النص الأكبر، أعلى الفقاعة، 17sp / w600.
//   النص الأصلي يظهر **فقط** إذا اختلفت لغة المرسل عن لغة القارئ.

import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

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
    this.showOriginalSetting = true,
  });

  final MessageEntity message;

  /// لغة القارئ الحالي — من AuthBloc: currentUser.preferredLanguage
  final String myLang;

  final bool isMine;

  /// نطق النص المعروض — TtsService
  final VoidCallback? onListen;

  /// A1 (مراجعة ٥ أغسطس) — إعادة محاولة تحويل صوتي فشل.
  final VoidCallback? onRetryTranscription;

  /// مفتاح المستخدم في «حسابي» لإظهار النص الأصلي
  final bool showOriginalSetting;

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
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          _SenderRow(
            name: message.senderName,
            time: l10n.formatTimeOfDay(TimeOfDay.fromDateTime(message.createdAt)),
            langCode: myLang,
          ),
          const SizedBox(height: Gap.xs),
          Align(
            alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
                decoration: BoxDecoration(
                  color: isMine ? AppColors.brand : Colors.white,
                  borderRadius: R.bubbleR(isMine: isMine, isRtl: isRtl),
                  border: isMine ? null : Border.all(color: AppColors.divider),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ---- ٠ — مرفق صورة (المهمة ٧): كان غائبًا كليًا،
                    // وليس مجرد عرض أسود كما وُصِف — لم يوجد أي
                    // Image.network في مسار العرض إطلاقًا. ----
                    for (final attachment in message.attachments.where((a) => a.kind == MessageAttachmentKind.image)) ...[
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 220),
                          child: Image.network(
                            attachment.url,
                            fit: BoxFit.cover,
                            loadingBuilder: (context, child, progress) => progress == null
                                ? child
                                : const SizedBox(height: 120, child: Center(child: CircularProgressIndicator())),
                            errorBuilder: (context, error, stackTrace) => SizedBox(
                              height: 100,
                              child: Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.broken_image_outlined, color: metaFg),
                                    const SizedBox(height: 4),
                                    Text('chat.image_load_failed'.tr(), style: TextStyle(fontSize: FS.caption, color: metaFg)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
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
                      // ١ — الترجمة: النص الأكبر والأهم
                      Text(
                        displayText,
                        style: TextStyle(
                          fontFamily: fontFamilyFor(myLang),
                          fontSize: FS.message,
                          fontWeight: FontWeight.w600,
                          height: 1.55,
                          color: fg,
                        ),
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

class _SenderRow extends StatelessWidget {
  const _SenderRow({required this.name, required this.time, required this.langCode});

  final String name;
  final String time;
  final String langCode;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(name, style: const TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(width: Gap.sm),
        Text(localizedDigits(time, langCode), style: const TextStyle(fontSize: FS.caption, color: AppColors.textSecondary)),
      ],
    );
  }
}

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
