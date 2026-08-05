import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCertificationDto {
  @IsString()
  userId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsDateString()
  issuedAt: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}
