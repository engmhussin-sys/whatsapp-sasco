import { IsString, MinLength } from 'class-validator';

export class UpsertDictionaryTermDto {
  @IsString()
  @MinLength(1)
  sourceTerm: string;

  @IsString()
  sourceLanguage: string;

  @IsString()
  targetLanguage: string;

  @IsString()
  @MinLength(1)
  translatedTerm: string;
}
