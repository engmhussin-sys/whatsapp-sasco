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

  // Smart Channels context anchors — exactly one is required depending on `type`.
  @IsOptional()
  @IsString()
  contextShiftLogId?: string;

  @IsOptional()
  @IsString()
  contextStationId?: string;

  @IsOptional()
  @IsString()
  contextTaskId?: string;

  // Member ids to add besides the creator. For DIRECT, exactly one other id.
  // Optional for STATION (auto-derived from the station's assigned staff)
  // and ANNOUNCEMENT/EMERGENCY (auto-derived: entire company).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}
