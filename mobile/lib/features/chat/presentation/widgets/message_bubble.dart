import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import '../../../../core/constants/supported_locales.dart';
import '../../../../core/theme/app_colors.dart';
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
                if (isMine) ...[
                  const SizedBox(width: 4),
                  Icon(_statusIcon(message.status), size: 12, color: Colors.white70),
                ],
              ],
            ),
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
