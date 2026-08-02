import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { TranslationProviderType } from '@prisma/client';

export class UpsertProviderConfigDto {
  @IsEnum(TranslationProviderType)
  providerType: TranslationProviderType;

  @IsOptional()
  @IsString()
  apiKeyEnvVar?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class TranslateRequestDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsString()
  sourceLanguage: string;

  @IsString()
  targetLanguage: string;
}
