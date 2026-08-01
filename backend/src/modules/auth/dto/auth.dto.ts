import { IsEmail, IsString, MinLength, IsOptional, IsUUID } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Optional: allows email to be reused across companies (unique per companyId+email).
  // If omitted, backend resolves company via a verified single match or requires it
  // for multi-company emails (edge case documented in API docs).
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
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  resetToken: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
