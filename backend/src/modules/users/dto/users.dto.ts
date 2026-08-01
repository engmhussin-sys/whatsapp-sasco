import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  // Optional as of Sprint 3: the Enterprise onboarding flow lets a
  // Company Admin/HR create the account with NO password at all — the
  // worker sets their own PIN/password during OTP activation (see
  // OnboardingService). If provided anyway (e.g. bulk-import scripts),
  // it's used as a temporary credential the worker can still activate over.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  // Now effectively required in practice for the OTP-by-phone activation
  // path, but kept optional at the DTO level since email-OTP is also
  // supported and some companies may only use email.
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
