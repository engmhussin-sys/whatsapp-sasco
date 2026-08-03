import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../../core/constants/supported_locales.dart';
import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/message_attachment_entity.dart';
import '../../domain/entities/message_entity.dart';
import 'voice_message_player.dart';

/// The core translation UX: two-tier text — the recipient's language on
/// top (large, what they actually read), the ORIGINAL as-written text
/// underneath (small, always available, never lost) so the reader can
/// always cross-check against what was really said. All translation
/// happens server-side (Translation Engine) — this widget only ever
/// DISPLAYS `message.displayText(myLang)` and never calls any provider.
class MessageBubble extends StatelessWidget {
  final MessageEntity message;
  final bool isMine;
  final String myLang;
  final VoidCallback? onListen;

  /// The user's "إظهار النص الأصلي" profile preference (defaults to
  /// true) — independent from isTranslatedFor(): even when a real
  /// translation exists, the original row only renders if BOTH this is
  /// true AND a translation actually exists.
  final bool showOriginalSetting;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMine,
    required this.myLang,
    this.onListen,
    this.showOriginalSetting = true,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isDeletedForEveryone) return _buildTombstone(context);

    final showOriginal = message.isTranslatedFor(myLang) && showOriginalSetting;
    final missingTranslation = message.translationMissingFor(myLang);

    return Align(
      alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
        decoration: BoxDecoration(
          color: isMine ? AppColors.brand : Colors.white,
          border: isMine ? null : Border.all(color: AppColors.divider),
          borderRadius: BorderRadiusDirectional.only(
            topStart: const Radius.circular(16),
            topEnd: const Radius.circular(16),
            // Speech-bubble "tail" — the corner nearest the sender is
            // sharp, the opposite corner stays fully rounded.
            bottomStart: Radius.circular(isMine ? 16 : 4),
            bottomEnd: Radius.circular(isMine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // ---- Group 2 (WhatsApp parity): quoted reply preview ----
            if (message.replyTo != null) _ReplyQuoteBlock(reply: message.replyTo!, isMine: isMine),

            // ---- Group 1 (WhatsApp parity): image/document attachments ----
            for (final attachment in message.attachments) ...[
              _AttachmentView(attachment: attachment, isMine: isMine),
              const SizedBox(height: 6),
            ],

            if (message.type == MessageType.voice && message.audioUrl != null)
              VoiceMessagePlayer(audioUrl: message.audioUrl!, isMine: isMine)
            else ...[
              // ---- 1. Translation (or original if same language) — the primary, large text ----
              Text(
                message.displayText(myLang),
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  height: 1.55,
                  color: isMine ? Colors.white : AppColors.textPrimary,
                ),
              ),

              // ---- 2. Original text row — only when what's shown above is actually a translation ----
              if (showOriginal) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: _DashedDivider(color: isMine ? Colors.white38 : AppColors.divider),
                ),
                Text(
                  '${'chat.original'.tr()} (${_languageNativeName(message.originalLang)})',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 0.4,
                    color: isMine ? Colors.white70 : AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message.text ?? '',
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.5,
                    color: isMine ? Colors.white70 : AppColors.textSecondary,
                  ),
                ),
              ],

              // ---- 3. Translation-missing notice ----
              if (missingTranslation) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accent.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'chat.translation_failed'.tr(),
                    style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: AppColors.accent),
                  ),
                ),
              ],
            ],

            const SizedBox(height: 6),

            // ---- 4. Bottom row: Listen + time + delivery status ----
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message.type != MessageType.voice) ...[
                  InkWell(
                    onTap: onListen,
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.volume_up_rounded, size: 15, color: isMine ? Colors.white70 : AppColors.textSecondary),
                          const SizedBox(width: 3),
                          Text(
                            'chat.listen'.tr(),
                            style: TextStyle(fontSize: 11, color: isMine ? Colors.white70 : AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Text(
                  _formatTime(message.createdAt),
                  style: TextStyle(fontSize: 10, color: isMine ? Colors.white70 : AppColors.textSecondary),
                ),
                if (message.editedAt != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    'تم التعديل',
                    style: TextStyle(fontSize: 9.5, fontStyle: FontStyle.italic, color: isMine ? Colors.white70 : AppColors.textSecondary),
                  ),
                ],
                if (isMine) ...[
                  const SizedBox(width: 4),
                  Icon(
                    _statusIcon(message.status),
                    size: 12,
                    // "Read" ticks go fully opaque white to stand out
                    // against the brand-green bubble — WhatsApp's blue
                    // convention is deliberately NOT used here, since
                    // this project's own design rule explicitly
                    // forbids any blue accent anywhere (see T3 rule:
                    // "لا يوجد أي أثر للأزرق"). Sent/delivered stay
                    // muted (white70) so "read" is the one that visibly
                    // pops.
                    color: message.status == MessageDeliveryStatus.read ? Colors.white : Colors.white70,
                  ),
                ],
              ],
            ),

            // ---- Group 3 (WhatsApp parity): reaction summary chips ----
            if (message.reactionCounts.isNotEmpty) ...[
              const SizedBox(height: 4),
              Wrap(
                spacing: 4,
                children: message.reactionCounts.entries
                    .map((e) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: isMine ? Colors.white.withValues(alpha: 0.2) : AppColors.surfaceLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '${e.key} ${e.value}',
                            style: TextStyle(fontSize: 11, color: isMine ? Colors.white : AppColors.textPrimary),
                          ),
                        ))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) =>
      '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

  IconData _statusIcon(MessageDeliveryStatus status) {
    switch (status) {
      case MessageDeliveryStatus.read:
        return Icons.done_all;
      case MessageDeliveryStatus.delivered:
        return Icons.done_all;
      case MessageDeliveryStatus.sent:
        return Icons.done;
    }
  }

  /// Group 2 (WhatsApp parity) — "🚫 هذه الرسالة حُذفت" tombstone. The
  /// server already blanked originalText/audioUrl, so there is nothing
  /// to accidentally leak even if this rendering were bypassed somehow.
  Widget _buildTombstone(BuildContext context) {
    return Align(
      alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          border: Border.all(color: AppColors.divider),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            Icon(Icons.block_rounded, size: 15, color: AppColors.textSecondary),
            SizedBox(width: 6),
            Text('هذه الرسالة حُذفت', style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: AppColors.textSecondary)),
          ],
        ),
      ),
    );
  }
}

/// Group 2 (WhatsApp parity) — the quoted block shown at the top of a
/// reply bubble (sender name + a one-line preview of what's being replied to).
class _ReplyQuoteBlock extends StatelessWidget {
  final ReplyPreview reply;
  final bool isMine;
  const _ReplyQuoteBlock({required this.reply, required this.isMine});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isMine ? Colors.white.withValues(alpha: 0.15) : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(8),
        border: BorderDirectional(start: BorderSide(color: isMine ? Colors.white : AppColors.brand, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(reply.senderName, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: isMine ? Colors.white : AppColors.brand)),
          Text(
            reply.text ?? '',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: isMine ? Colors.white70 : AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Minimal dashed divider (avoids pulling in a new package for one line).
class _DashedDivider extends StatelessWidget {
  final Color color;
  const _DashedDivider({required this.color});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 4.0;
        const dashSpace = 3.0;
        final dashCount = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return Row(
          children: List.generate(
            dashCount,
            (_) => Padding(
              padding: const EdgeInsets.only(left: dashSpace),
              child: Container(width: dashWidth, height: 1, color: color),
            ),
          ),
        );
      },
    );
  }
}

/// Looks up a language code's native display name from the same
/// SupportedLocales catalog that drives the app's own language picker —
/// single source of truth, no separate hardcoded name list to drift
/// out of sync.
String _languageNativeName(String code) {
  final match = SupportedLocales.active.where((l) => l.locale.languageCode == code);
  if (match.isNotEmpty) return match.first.nativeName;
  return code.toUpperCase();
}

/// Group 1 (WhatsApp parity) — renders an image inline (tap to view
/// full-screen) or a document as a compact file card (icon + name +
/// size). No image assets were provided anywhere in this project's
/// design handoff, so the `errorBuilder` fallback (a plain broken-image
/// icon) is the honest behavior for a URL that fails to load — nothing
/// fancier is invented here.
class _AttachmentView extends StatelessWidget {
  final MessageAttachmentEntity attachment;
  final bool isMine;
  const _AttachmentView({required this.attachment, required this.isMine});

  @override
  Widget build(BuildContext context) {
    if (attachment.kind == MessageAttachmentKind.image) {
      return GestureDetector(
        onTap: () => _openFullScreen(context),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            attachment.url,
            width: 220,
            height: 220,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, progress) => progress == null
                ? child
                : const SizedBox(width: 220, height: 220, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
            errorBuilder: (context, error, stackTrace) => Container(
              width: 220,
              height: 220,
              color: AppColors.divider,
              child: const Icon(Icons.broken_image_outlined, color: AppColors.textSecondary, size: 32),
            ),
          ),
        ),
      );
    }

    // Document / other file kinds — a compact file card.
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isMine ? Colors.white.withValues(alpha: 0.15) : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insert_drive_file_outlined, color: isMine ? Colors.white : AppColors.brand, size: 28),
          const SizedBox(width: 8),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  attachment.fileName ?? 'ملف',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: isMine ? Colors.white : AppColors.textPrimary),
                ),
                if (attachment.sizeLabel.isNotEmpty)
                  Text(attachment.sizeLabel, style: TextStyle(fontSize: 11, color: isMine ? Colors.white70 : AppColors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openFullScreen(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, iconTheme: const IconThemeData(color: Colors.white)),
        body: Center(child: InteractiveViewer(child: Image.network(attachment.url))),
      ),
    ));
  }
}
