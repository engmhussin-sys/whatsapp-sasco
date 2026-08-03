import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';
import { HazardKind, HazardStatus } from '@prisma/client';

export class ReportHazardDto {
  @IsEnum(HazardKind)
  kind: HazardKind;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;
}

export class UpdateHazardStatusDto {
  @IsEnum(HazardStatus)
  status: HazardStatus;
}

export class RaiseSosDto {
  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
