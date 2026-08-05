import { IsOptional, IsString, MinLength } from 'class-validator';

export class CheckInVisitorDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  hostUserId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  badgeNumber?: string;
}
