// message_bubble.dart — دُمِج مع منطق حالة فشل تحويل الصوت إلى نص وزر
// إعادة المحاولة (A1، جلسة سابقة) بدل استبداله كليًا — القاعدة الحاكمة
// في design_handoff_atheel_community صريحة: "الكود هو الحقيقة عند
// التعارض، نفّذ الأقرب للنمط القائم وأبلِغ عن الفرق".
//
// القاعدة الحاكمة (لا تكسرها):
//   الترجمة = النص الأكبر، أعلى الفقاعة، 17sp / w600.
//   النص الأصلي يظهر **فقط** إذا اختلفت لغة المرسل عن لغة القارئ.

import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:ui' show ImageFilter;
import 'dart:convert';
import 'dart:typed_data';
import 'package:easy_localization/easy_localization.dart' hide TextDirection;

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/design_tokens.dart';
import '../../domain/entities/message_entity.dart';
import '../../domain/entities/message_attachment_entity.dart';
import 'voice_message_player.dart';
import 'document_attachment_card.dart';

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
    this.allConversationImageUrls,
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

  /// CHAT_SPEC.md §4: تُمرَّر من ChatPage (حيث ChatBloc.state.messages
  /// متاحة بالكامل) — كل روابط صور المحادثة، لدعم التمرير بين الصور
  /// داخل العارض. null تعني عرض صورة الرسالة الحالية فقط.
  final List<String>? allConversationImageUrls;

  @override
  Widget build(BuildContext context) {
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    final l10n = MaterialLocalizations.of(context);

    final displayText = message.displayText(myLang);
    // REVIEW_ROUND7.md §2: "رسائلي لا تُترجم لي أبداً" — كانت الشارة
    // وصفّ النص الأصلي يُحسَبان بصرف النظر عن isMine، فرسالة كتبتُها أنا
    // بالإنجليزية (بينما لغتي عربية) كانت تُعرَض كأن الترجمة فشلت، رغم
    // أنني كتبتُها بنفسي وأفهمها تماماً. شرط !isMine سابق لكل منطق
    // الترجمة، لا استثناء واحد.
    final isTranslated = !isMine && message.isTranslatedFor(myLang);
    final translationMissing = !isMine && message.translationMissingFor(myLang);
    final showOriginal = isTranslated && showOriginalSetting;

    // A1: حالة تحويل الصوت — لا تزال قيد المعالجة، أو فشلت صراحةً.
    final isTranscribing = message.type == MessageType.voice && (message.text == null || message.text!.isEmpty);
    final transcriptionFailed = message.text == 'تعذّر تحويل هذه الرسالة الصوتية إلى نص';

    final fg = isMine ? Colors.white : AppColors.textPrimary;
    final metaFg = isMine ? Colors.white70 : AppColors.textSecondary;
    final ruleColor = isMine ? Colors.white30 : AppColors.divider;

    // CHAT_SPEC.md §1: الصورة الرمزية الجانبية — تظهر فقط للرسائل
    // الواردة في محادثة جماعية، وللأولى في كل مجموعة تحديداً (بقية
    // المجموعة تحصل على مساحة فارغة بنفس العرض لمحاذاة عمودية متسقة).
    final showAvatarSlot = isGroupChat && !isMine;
    final bubbleColumn = Column(
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
                    // ---- CHAT_SPEC.md §3: مشغّل الصوت — اكتشاف حرج:
                    // كان VoiceMessagePlayer مكتوباً بالكامل لكن يتيماً
                    // تماماً، لا يُستدعى من أي مكان. الرسالة الصوتية بعد
                    // نجاح التحويل كانت تُعرض كنص عادي بلا أي إمكانية
                    // لتشغيل الصوت الأصلي إطلاقاً. ----
                    if (message.type == MessageType.voice && message.audioUrl != null) ...[
                      VoiceMessagePlayer(
                        messageId: message.id,
                        audioUrl: message.audioUrl!,
                        isMine: isMine,
                        initialDurationMs: message.audioDurationMs,
                        amplitudes: message.voiceAmplitudes,
                        senderName: message.senderName,
                      ),
                      if (!isTranscribing && !transcriptionFailed) ...[
                        const SizedBox(height: Gap.sm),
                        _DashedRule(color: ruleColor),
                        const SizedBox(height: Gap.sm),
                      ],
                    ],
                    // ---- ٠ — مرفق صورة (المهمة ٧): كان غائبًا كليًا،
                    // وليس مجرد عرض أسود كما وُصِف — لم يوجد أي
                    // Image.network في مسار العرض إطلاقًا. ----
                    for (final attachment in message.attachments.where((a) => a.kind == MessageAttachmentKind.image)) ...[
                      _RetryableImage(
                        url: attachment.url,
                        metaFg: metaFg,
                        width: attachment.width,
                        height: attachment.height,
                        thumbnailBase64: attachment.thumbnailBase64,
                        allImageUrls: allConversationImageUrls,
                      ),
                      const SizedBox(height: Gap.sm),
                    ],
                    // ---- CHAT_SPEC.md §5: الملف المرفق — كان غائباً
                    // كلياً؛ فقط الصور كانت تُعرض من بين كل المرفقات. ----
                    for (final attachment in message.attachments.where((a) => a.kind != MessageAttachmentKind.image)) ...[
                      DocumentAttachmentCard(attachment: attachment, isMine: isMine),
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
                      // REVIEW_ROUND5.md §A4: كانت تعتمد كلياً على تحديث
                      // الخادم عبر message:translated — إن تعطَّلت المعالجة
                      // الخلفية بصمت أو استغرقت وقتاً غير محدود، تبقى
                      // الحالة "جارٍ التحويل" للأبد بلا أي مخرج. مهلة ٣٠
                      // ثانية من العميل نفسه تُحوِّلها محلياً لحالة فشل
                      // صريحة (نفس عرض transcriptionFailed أعلاه) — مُقيَّدة
                      // بمعرّف الرسالة كـ key كي لا يُعاد ضبط المؤقّت خطأً
                      // عند أي إعادة بناء غير متعلقة بهذه الفقاعة تحديداً.
                      _TranscriptionTimeoutGate(
                        key: ValueKey('transcribe-timeout-${message.id}'),
                        builder: (context, timedOut) {
                          if (timedOut) {
                            return Row(
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
                            );
                          }
                          return Row(
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
                          );
                        },
                      ),
                    ] else ...[
                      // REVIEW_ROUND5.md §B1 + PROMPT_ROUND6.md §A-3:
                      // الصفّ السفلي [استمع، الوقت، العلامة] كان يُوضَع هنا
                      // مباشرة بعد النص المُترجَم، قبل قسم "النص الأصلي"
                      // الذي يليه في الشجرة — فانتهى الأمر بالصفّ السفلي في
                      // *منتصف* الفقاعة بدل نهايتها الفعلية. الترتيب
                      // الصحيح الآن: المحتوى → الفاصل → «النص الأصلي ·
                      // English» → النص الأصلي → تنبيه ترجمة مفقودة →
                      // الصفّ السفلي (آخر عنصر دائماً، بلا استثناء).
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

                      // ٤ — الصفّ السفلي: دائماً آخر عنصر، بصرف النظر عن
                      // وجود نص أصلي أو تنبيه ترجمة مفقودة أعلاه أم لا.
                      const SizedBox(height: Gap.xs),
                      Row(
                        children: [
                          if (onListen != null && !isTranscribing)
                            _ListenButton(label: 'chat.listen'.tr(), onTap: onListen!, isMine: isMine)
                          else
                            const SizedBox.shrink(),
                          const Spacer(),
                          _MetaRow(
                            time: l10n.formatTimeOfDay(TimeOfDay.fromDateTime(message.createdAt)),
                            langCode: myLang,
                            isMine: isMine,
                            status: message.status,
                            metaFg: metaFg,
                            onRetrySend: onRetrySend,
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
    );

    return Padding(
      // CHAT_SPEC.md §1: "المسافة بين رسالتين: 2dp لنفس المرسِل · 8dp
      // عند تغيّر المرسِل". Gap.md=12 هنا يبقى الافتراضي غير المُجمَّع؛
      // 2dp فقط عند isGroupedWithPrevious.
      padding: EdgeInsets.only(bottom: isGroupedWithPrevious ? 2 : Gap.md),
      child: !showAvatarSlot
          ? bubbleColumn
          : Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // CHAT_SPEC.md §1: صورة رمزية 26dp للأولى في المجموعة؛
                // مساحة فارغة بنفس العرض الكلي للبقية كي تبقى الفقاعات
                // محاذاة عمودياً بدقة على طول المجموعة.
                SizedBox(
                  width: 32,
                  child: isGroupedWithPrevious
                      ? null
                      : Padding(
                          padding: const EdgeInsetsDirectional.only(end: 6),
                          child: CircleAvatar(
                            radius: 13,
                            backgroundColor: AppColors.brandLight,
                            backgroundImage: message.senderAvatarUrl != null ? NetworkImage(message.senderAvatarUrl!) : null,
                            child: message.senderAvatarUrl == null
                                ? Text(
                                    message.senderName.isNotEmpty ? message.senderName[0] : '?',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.brandDark),
                                  )
                                : null,
                          ),
                        ),
                ),
                Expanded(child: bubbleColumn),
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
  const _RetryableImage({
    required this.url,
    required this.metaFg,
    this.width,
    this.height,
    this.thumbnailBase64,
    this.allImageUrls,
  });
  final String url;
  final Color metaFg;
  /// CHAT_SPEC.md §4: أبعاد حقيقية من الخادم — تحجز المساحة الصحيحة
  /// *قبل* اكتمال التحميل، فلا تقفز الفقاعة.
  final int? width;
  final int? height;
  final String? thumbnailBase64;
  /// CHAT_SPEC.md §4: كل روابط صور المحادثة — يسمح بالتمرير بين
  /// الصور داخل العارض. null/فارغة تعني عرض هذه الصورة وحدها فقط.
  final List<String>? allImageUrls;

  @override
  State<_RetryableImage> createState() => _RetryableImageState();
}

class _RetryableImageState extends State<_RetryableImage> {
  int _attempt = 0;

  Uint8List? get _thumbnailBytes {
    if (widget.thumbnailBase64 == null) return null;
    try {
      final base64Part = widget.thumbnailBase64!.split(',').last;
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    // CHAT_SPEC.md §4: "عرض 240dp، ارتفاع من نسبة الصورة، min 120 / max 300dp"
    final aspectRatio = (widget.width != null && widget.height != null && widget.height! > 0)
        ? widget.width! / widget.height!
        : 240 / 180;
    final targetHeight = (240 / aspectRatio).clamp(120.0, 300.0);
    final thumbBytes = _thumbnailBytes;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) {
            final urls = (widget.allImageUrls != null && widget.allImageUrls!.isNotEmpty) ? widget.allImageUrls! : [widget.url];
            final initialIndex = urls.indexOf(widget.url).clamp(0, urls.length - 1);
            return _FullScreenImageViewer(allImageUrls: urls, initialIndex: initialIndex);
          },
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(15), // CHAT_SPEC.md §4: radius داخلي 15dp
        child: SizedBox(
          width: 240,
          height: targetHeight,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // CHAT_SPEC.md §4/§9: المصغّرة الضبابية تظهر فوراً — لا
              // مربع رمادي فارغ — ثم تُستبدَل بالصورة الكاملة.
              if (thumbBytes != null)
                ImageFiltered(
                  imageFilter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Image.memory(thumbBytes, fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                )
              else
                Container(color: widget.metaFg.withValues(alpha: 0.08)),
              Image.network(
                widget.url,
                key: ValueKey(_attempt),
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                loadingBuilder: (context, child, progress) => progress == null
                    ? child
                    : thumbBytes != null
                        ? const SizedBox.shrink() // المصغّرة الضبابية تكفي أثناء التحميل
                        : const Center(child: CircularProgressIndicator()),
                errorBuilder: (context, error, stackTrace) => Container(
                  color: widget.metaFg.withValues(alpha: 0.08),
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
            ],
          ),
        ),
      ),
    );
  }
}

/// CHAT_SPEC.md §4: "العارض الكامل — نقرة → عارض بخلفية سوداء: تكبير
/// بالقرص، سحب لأسفل للإغلاق، شريط علوي". نسخة أساسية تُغطّي التكبير
/// والإغلاق بالسحب؛ الانتقال بين صور المحادثة ومشاركة/حفظ الملف تحتاج
/// عملاً إضافياً (قائمة صور المحادثة الكاملة، أذونات حفظ الملفات) —
/// موثَّق بصدق كنطاق متبقٍّ، لا مُدَّعى إكماله.
/// CHAT_SPEC.md §4: "انتقال أفقي بين صور المحادثة". [allImageUrls] هو
/// كل روابط صور المحادثة الحالية بترتيبها الزمني، و[initialIndex]
/// موقع الصورة التي نُقِر عليها ضمنها — تسمح بالتمرير الأفقي بين كل
/// صور المحادثة دون إغلاق العارض والعودة لفتح صورة أخرى يدوياً.
class _FullScreenImageViewer extends StatefulWidget {
  const _FullScreenImageViewer({required this.allImageUrls, required this.initialIndex});
  final List<String> allImageUrls;
  final int initialIndex;

  @override
  State<_FullScreenImageViewer> createState() => _FullScreenImageViewerState();
}

class _FullScreenImageViewerState extends State<_FullScreenImageViewer> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragEnd: (details) {
        if ((details.primaryVelocity ?? 0) > 200) Navigator.of(context).pop();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
        ),
        body: PageView.builder(
          controller: _pageController,
          itemCount: widget.allImageUrls.length,
          itemBuilder: (context, index) => Center(
            child: InteractiveViewer(
              minScale: 1,
              maxScale: 4,
              child: Image.network(widget.allImageUrls[index], fit: BoxFit.contain),
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

  int get _colorIndex => name.codeUnits.fold(0, (sum, c) => sum + c) % AppColors.senderPalette.length;

  @override
  Widget build(BuildContext context) {
    return Text(name, style: TextStyle(fontSize: FS.caption, fontWeight: FontWeight.w700, color: AppColors.senderPalette[_colorIndex]));
  }
}

/// REVIEW_ROUND5.md §A4: مؤقّت ٣٠ ثانية محلي — إن لم يصل تحديث من
/// الخادم (originalText يصبح غير فارغ) خلال هذه المهلة، يُصدر
/// `timedOut: true` فيعرض المستدعي حالة فشل صريحة بدل انتظار أبدي.
class _TranscriptionTimeoutGate extends StatefulWidget {
  const _TranscriptionTimeoutGate({super.key, required this.builder});
  final Widget Function(BuildContext context, bool timedOut) builder;

  @override
  State<_TranscriptionTimeoutGate> createState() => _TranscriptionTimeoutGateState();
}

class _TranscriptionTimeoutGateState extends State<_TranscriptionTimeoutGate> {
  bool _timedOut = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 30), () {
      if (mounted) setState(() => _timedOut = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _timedOut);
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
        // PROMPT_ROUND6.md: أزرق واتساب الحرفي — استثناء وحيد مقصود عن
        // نظام الألوان الحر لأنه معيار تعرّف عالمي، الآن ثابت مُسمّى
        // (AppColors.whatsappReadTick) بدل استثناء خاص في الاختبار.
        return const Icon(Icons.done_all, size: 14, color: AppColors.whatsappReadTick);
      case MessageDeliveryStatus.failed:
        return const Icon(Icons.error_outline, size: 13, color: AppColors.danger);
    }
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
