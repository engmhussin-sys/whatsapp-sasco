import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendTextMessageDto {
  @IsString()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsString()
  originalLang?: string; // if omitted, resolved from sender.preferredLanguage
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
