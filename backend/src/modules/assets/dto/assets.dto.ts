import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export enum AssetStatusDto {
  ACTIVE = 'ACTIVE',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  RETIRED = 'RETIRED',
}

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsNumber()
  valueSar?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsEnum(AssetStatusDto)
  status?: AssetStatusDto;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateVehicleDto {
  @IsString()
  @MinLength(1)
  plateNumber: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsEnum(AssetStatusDto)
  status?: AssetStatusDto;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsDateString()
  lastMaintenanceAt?: string;

  @IsOptional()
  @IsDateString()
  nextMaintenanceAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
