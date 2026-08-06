import { IsEmail, IsString, MinLength, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class CreateUserDto {
  // Either email or phone (or both) is required — many station workers
  // are registered by phone only on mobile, matching LoginDto's exact
  // same either-or pattern (see auth.dto.ts) rather than forcing every
  // dashboard-created account to have an email it will never use.
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;

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

  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole; // Company Admin can set WORKER/TEAM_LEAD; only Super Admin can set COMPANY_ADMIN

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  primaryStationId?: string;
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

  // Gap fix (real-user verification, 2026-08-06): a Company Admin had
  // no way to reset a worker's forgotten password, change their role
  // after creation, or assign them to a specific station — the DTO
  // simply never carried these fields, even though the underlying
  // columns (User.systemRole, User.primaryStationId) already existed.
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @IsOptional()
  @IsString()
  primaryStationId?: string;
}
