import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class CreateTankDto {
  @IsString()
  code: string;

  @IsString()
  fuelType: string;

  @IsNumber()
  capacityLiters: number;
}

export class UpdateTankLevelDto {
  @IsNumber()
  level: number;
}
