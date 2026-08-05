import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum KnowledgeArticleCategoryDto {
  GETTING_STARTED = 'GETTING_STARTED',
  MODULES = 'MODULES',
  BILLING = 'BILLING',
  TROUBLESHOOTING = 'TROUBLESHOOTING',
  OTHER = 'OTHER',
}

export class CreateKnowledgeArticleDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsEnum(KnowledgeArticleCategoryDto)
  category?: KnowledgeArticleCategoryDto;

  // Omitted entirely (not even optional-false) means platform-wide —
  // set explicitly by the super-admin-only "platform article" endpoint.
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateKnowledgeArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(KnowledgeArticleCategoryDto)
  category?: KnowledgeArticleCategoryDto;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
