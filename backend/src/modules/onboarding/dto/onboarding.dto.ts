import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OtpChannel, CredentialType } from '@prisma/client';

export class RequestActivationOtpDto {
  // Worker identifies themselves by the email/phone the Company
  // Admin registered them with — NOT a self-chosen identifier, matching
  // the "admin creates, worker only activates" rule.
  @IsEmail()
  email: string;

  @IsEnum(OtpChannel)
  channel: OtpChannel; // PHONE or EMAIL — determines where the code is "sent"

  // Optional, same disambiguation pattern as LoginDto.companyId — only
  // needed if the same email was registered as a worker in more than
  // one company (rare, but the schema allows it).
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class VerifyActivationOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string;
}

export class SetActivationCredentialsDto {
  @IsEmail()
  email: string;

  // Short-lived token returned by verify-otp, proves the OTP step
  // already succeeded — prevents skipping straight to credential-setting.
  @IsString()
  activationToken: string;

  @IsEnum(CredentialType)
  credentialType: CredentialType;

  @IsString()
  @MinLength(4) // PINs may be as short as 4 digits; PASSWORD still needs 8+ (checked below)
  credential: string;
}

export class BiometricPreferenceDto {
  @IsOptional()
  biometricEnabled?: boolean;
}
