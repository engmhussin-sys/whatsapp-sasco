import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole; // Company Admin can set WORKER/TEAM_LEAD; only Super Admin can set COMPANY_ADMIN

  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  isActive?: boolean;
}
