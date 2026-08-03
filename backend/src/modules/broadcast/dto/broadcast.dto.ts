import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class SendBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;

  @IsString()
  sourceLanguage: string;

  @IsIn(['ALL', 'ROLE', 'STATION', 'TEAM', 'USER'])
  targetType: 'ALL' | 'ROLE' | 'STATION' | 'TEAM' | 'USER';

  @ValidateIf((o) => o.targetType === 'ROLE')
  @IsEnum(SystemRole)
  role?: SystemRole;

  @ValidateIf((o) => o.targetType === 'STATION')
  @IsString()
  stationId?: string;

  @ValidateIf((o) => o.targetType === 'TEAM')
  @IsString()
  teamId?: string;

  @ValidateIf((o) => o.targetType === 'USER')
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean; // true = EMERGENCY channel instead of ANNOUNCEMENT — only meaningful for targetType=ALL
}
