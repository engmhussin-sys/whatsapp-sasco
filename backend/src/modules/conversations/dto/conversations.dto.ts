import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  teamId?: string; // required when type === TEAM

  // Member ids to add besides the creator. For DIRECT, exactly one other id.
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}
