import type { Message } from './types';

/**
 * Mirrors mobile's MessageEntity.displayText()/isTranslatedFor()/
 * translationMissingFor() exactly (see mobile/lib/features/chat/domain/
 * entities/message_entity.dart). Centralized here so every dashboard
 * surface that renders message text — the chat page, the conversation
 * list's last-message preview, anywhere else added later — shows the
 * VIEWER's translation instead of the sender's original wording, rather
 * than each place needing to remember to re-implement this itself.
 */
export function displayText(m: Message, myLang: string): string {
  if (!m.originalLang || myLang === m.originalLang) return m.originalText ?? '';
  const match = m.translations?.find((t) => t.langCode === myLang);
  return match?.translatedText ?? m.originalText ?? '';
}

export function isTranslatedFor(m: Message, myLang: string): boolean {
  return !!m.originalLang && myLang !== m.originalLang && !!m.translations?.some((t) => t.langCode === myLang);
}

export function translationMissingFor(m: Message, myLang: string): boolean {
  return !!m.originalLang && myLang !== m.originalLang && !m.translations?.some((t) => t.langCode === myLang);
}
