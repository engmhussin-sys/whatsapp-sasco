import { IsEmail, IsString, MinLength, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class LoginDto {
  // Exactly one of email/phone must be provided — station workers often
  // have no email at all, so phone-based login is a first-class path,
  // not a fallback.
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Optional: allows email/phone to be reused across companies (unique per companyId+identifier).
  // If omitted, backend resolves company via a verified single match or requires it
  // for multi-company identifiers (edge case documented in API docs).
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class RequestPasswordResetDto {
  // BUG FIX (real, known gap — a phone-only worker had no way to
  // reset a forgotten password at all): mirrors LoginDto's exact
  // either-or pattern rather than hard-requiring email.
  @ValidateIf((o) => !o.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((o) => !o.email)
  @IsString()
  phone?: string;
}

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
