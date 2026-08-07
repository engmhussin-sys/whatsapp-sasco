import 'package:equatable/equatable.dart';
import 'message_attachment_entity.dart';

enum MessageType { text, voice, system }
// CHAT_SPEC.md §1: أربع حالات تسليم مطلوبة (قيد الإرسال، أُرسلت،
// وصلت، قُرئت) + فشلت. `sent`/`delivered`/`read` تصل من الخادم فعلياً؛
// `sending`/`failed` حالتان محليتان بحتتان (النمط المتفائل الكامل —
// رسالة تظهر فوراً محلياً قبل تأكيد الخادم — عمل معماري منفصل لم يُبنَ
// بعد؛ هاتان القيمتان جاهزتان في النموذج لتلك الخطوة التالية).
enum MessageDeliveryStatus { sending, sent, delivered, read, failed }

/// Group 2 (WhatsApp parity) — lightweight quoted-preview of the message
/// being replied to. Deliberately NOT the full MessageEntity (avoids
/// unbounded reply-chain nesting problems) — just enough to render the
/// quote block: who said it, and what.
class ReplyPreview extends Equatable {
  final String messageId;
  final String senderName;
  final String? text;

  const ReplyPreview({required this.messageId, required this.senderName, this.text});

  @override
  List<Object?> get props => [messageId, senderName, text];
}

class MessageEntity extends Equatable {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  /// CHAT_SPEC.md §1: "اسم المرسِل والصورة الرمزية للأولى فقط" —
  /// كانت موجودة في استجابة الخادم (sender.avatarUrl) لكن غير مُستخرَجة
  /// في الموبايل إطلاقاً؛ null إن لم يضبط المستخدم صورة شخصية.
  final String? senderAvatarUrl;
  final MessageType type;
  final MessageDeliveryStatus status;
  final String? text;
  final String? audioUrl;
  final int? audioDurationMs;
  /// CHAT_SPEC.md §3/§9: قيم سعة صوت حقيقية 0-100 (45 قيمة عادةً) —
  /// null قبل اكتمال processVoiceMessage في الخادم، أو فارغة إن فشل
  /// الاستخراج. لا تُختلَق موجة عشوائية إن كانت null/فارغة — الواجهة
  /// تعرض خطًا متساوي الارتفاع بدلاً من موجة كاذبة.
  final List<int>? voiceWaveform;
  /// REVIEW_ROUND7.md §7-ج: "احسبها مرة واحدة عند تحميل الرسالة واحفظها
  /// في الكيان — لا داخل build()". محسوبة هنا في قائمة تهيئة المُنشئ
  /// (تُستدعى مرة واحدة فقط عند إنشاء الكائن، وليس في كل إعادة رسم)،
  /// 45 قيمة بالضبط بين 0.0 و1.0، من voiceWaveform الحقيقية إن توفّرت
  /// وإلا اشتقاق حتمي من id (ثابت لنفس الرسالة، ليس Random()).
  final List<double> voiceAmplitudes;
  final DateTime createdAt;
  final List<MessageAttachmentEntity> attachments;
  final ReplyPreview? replyTo;

  /// Group 3 (WhatsApp parity) — userId -> emoji. One reaction per user
  /// per message, mirrors the backend's compound-unique constraint
  /// exactly, so this map can never represent an invalid state.
  final Map<String, String> reactions;

  /// Group 3 — non-null once the sender has edited this message's text.
  /// The bubble shows a small "تم التعديل" label when set.
  final DateTime? editedAt;

  /// Group 2 (WhatsApp parity) — "Delete for everyone" tombstone flag. When true, `text`/
  /// `audioUrl` are already blanked server-side; the bubble renders a
  /// "🚫 هذه الرسالة حُذفت" placeholder instead of any content.
  final bool isDeletedForEveryone;

  /// Language the sender actually wrote in — 'ar' | 'ur' | 'hi' | 'bn' | 'en' | 'tl' | 'am' | ...
  final String originalLang;

  /// Server-produced translations, keyed by language code -> translated text.
  /// Populated entirely by the backend's Translation Engine (see
  /// MessagesService.fanOutTranslations) — never written to or computed
  /// on-device; this field is pass-through storage only.
  final Map<String, String> translations;

  MessageEntity({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    this.senderAvatarUrl,
    required this.type,
    required this.status,
    this.text,
    this.audioUrl,
    this.audioDurationMs,
    this.voiceWaveform,
    required this.createdAt,
    this.originalLang = 'ar',
    this.translations = const {},
    this.attachments = const [],
    this.replyTo,
    this.isDeletedForEveryone = false,
    this.reactions = const {},
    this.editedAt,
  }) : voiceAmplitudes = _computeAmplitudes(voiceWaveform, id);

  /// اشتقاق 45 قيمة (0.0-1.0) — من voiceWaveform الحقيقية إن توفّرت
  /// (تُحوَّل مباشرة من نطاق 0-100)، وإلا مولّد xorshift حتمي بذرته id
  /// (نفس الرسالة تُعطي نفس الشكل دائماً عبر كل إعادة بناء — لا Random()).
  static List<double> _computeAmplitudes(List<int>? waveform, String id) {
    if (waveform != null && waveform.isNotEmpty) {
      return List.generate(45, (i) {
        final idx = (i * waveform.length / 45).floor().clamp(0, waveform.length - 1);
        return (waveform[idx].clamp(0, 100)) / 100;
      });
    }
    final seed = id.codeUnits.fold<int>(7, (acc, c) => (acc * 31 + c) & 0x7fffffff);
    var x = seed == 0 ? 1 : seed;
    return List.generate(45, (i) {
      x ^= x << 13;
      x &= 0x7fffffff;
      x ^= x >> 17;
      x ^= x << 5;
      x &= 0x7fffffff;
      return 0.15 + ((x % 1000) / 1000) * 0.85;
    });
  }

  /// The text the CURRENT user should see: their language's translation if
  /// one exists, otherwise the original as-written text. This is the ONLY
  /// place this decision is made — widgets must call this, not
  /// re-implement the fallback logic themselves.
  String displayText(String myLang) => myLang == originalLang ? (text ?? '') : (translations[myLang] ?? text ?? '');

  /// True when what displayText() returns is an actual translation (not a
  /// same-language passthrough or a same-original fallback) — determines
  /// whether the UI shows the "original text" row underneath.
  bool isTranslatedFor(String myLang) => myLang != originalLang && translations.containsKey(myLang);

  /// True when the user's language differs from the original AND no
  /// translation has arrived for it yet (e.g. still processing, or the
  /// Translation Engine had no provider configured) — the UI shows a
  /// gentle "translation unavailable" notice rather than silently
  /// falling back with no explanation.
  bool translationMissingFor(String myLang) => myLang != originalLang && !translations.containsKey(myLang);

  /// Group 3 — reactions grouped by emoji -> count, for the summary row
  /// below a bubble (e.g. "❤️ 2 · 👍 1"), computed from the raw userId
  /// map rather than duplicated server-side.
  Map<String, int> get reactionCounts {
    final counts = <String, int>{};
    for (final emoji in reactions.values) {
      counts[emoji] = (counts[emoji] ?? 0) + 1;
    }
    return counts;
  }

  String? reactionOf(String userId) => reactions[userId];

  MessageEntity copyWith({MessageDeliveryStatus? status}) => MessageEntity(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        senderName: senderName,
        senderAvatarUrl: senderAvatarUrl,
        type: type,
        status: status ?? this.status,
        text: text,
        audioUrl: audioUrl,
        audioDurationMs: audioDurationMs,
        voiceWaveform: voiceWaveform,
        createdAt: createdAt,
        originalLang: originalLang,
        translations: translations,
        attachments: attachments,
        replyTo: replyTo,
        isDeletedForEveryone: isDeletedForEveryone,
        reactions: reactions,
        editedAt: editedAt,
      );

  @override
  List<Object?> get props => [
        id,
        conversationId,
        senderId,
        type,
        status,
        text,
        audioUrl,
        voiceWaveform,
        createdAt,
        originalLang,
        translations,
        attachments,
        replyTo,
        isDeletedForEveryone,
        reactions,
        editedAt,
      ];
}
