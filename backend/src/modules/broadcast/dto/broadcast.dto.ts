import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;

  @IsString()
  sourceLanguage: string;

  @IsOptional()
  @IsBoolean()
  urgent?: boolean; // true = EMERGENCY channel instead of ANNOUNCEMENT
}
