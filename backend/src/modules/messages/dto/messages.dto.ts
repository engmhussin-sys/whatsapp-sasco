import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsString()
  originalLang?: string; // if omitted, resolved from sender.preferredLanguage

  @IsOptional()
  @IsString()
  replyToId?: string; // Group 2 (WhatsApp parity): quote/reply-to

  // REVIEW_ROUND7.md §1: UUID مُولَّد في العميل قبل الإرسال — دفاع حقيقي
  // ضد الإرسال المزدوج عبر قيد فرادة في قاعدة البيانات نفسها، لا مجرد
  // حارس واجهة قابل للكسر.
  @IsOptional()
  @IsString()
  clientMessageId?: string;
}

export class DeleteMessageDto {
  @IsOptional()
  forEveryone?: boolean; // false/omitted = "delete for me" (handled client-side only, no server call needed)
}

export class ReactToMessageDto {
  @IsString()
  @MaxLength(8) // a single emoji, generous margin for multi-codepoint ones (e.g. skin-tone modifiers)
  emoji: string;
}

export class EditMessageDto {
  @IsString()
  @MaxLength(4000)
  text: string;
}

export class MarkReadDto {
  @IsOptional()
  @IsString()
  upToMessageId?: string; // if omitted, marks the latest message as read
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string; // message id to paginate before (older messages)

  @IsOptional()
  take?: number;
}
