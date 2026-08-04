import { IsString, IsOptional, MinLength, IsEmail, IsEnum, IsInt, Min, IsArray } from 'class-validator';
import { SubscriptionPlan, ModuleCode } from '@prisma/client';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  // Initial Company Admin created together with the tenant.
  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsString()
  adminFirstName: string;

  @IsString()
  adminLastName: string;

  // Sprint 4 (co_new wizard, steps 3-4) — all optional, defaulting to
  // the pre-Sprint-4 behavior (TRIAL / 10 seats / no extra modules
  // beyond Sprint 1's default backfill) so the plain-DTO POST /companies
  // callers from before this sprint keep working unchanged.
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ModuleCode, { each: true })
  moduleCodes?: ModuleCode[];
}

export class UpdateTaxonomyDto {
  @IsOptional()
  @IsString()
  presetCode?: string;

  @IsOptional()
  @IsArray()
  levels?: {
    key: string;
    labelSingularAr: string;
    labelPluralAr: string;
    labelSingularEn: string;
    labelPluralEn: string;
  }[];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  isActive?: boolean;

  // Enterprise Platform pivot, Sprint 2: what this company calls its
  // organizational unit (e.g. "Station" for fuel, "Hospital" for
  // healthcare, "Site" for construction) — see Company model's own doc
  // comment in schema.prisma for the full rationale.
  @IsOptional()
  @IsString()
  orgUnitLabelSingularEn?: string;

  @IsOptional()
  @IsString()
  orgUnitLabelPluralEn?: string;

  @IsOptional()
  @IsString()
  orgUnitLabelSingularAr?: string;

  @IsOptional()
  @IsString()
  orgUnitLabelPluralAr?: string;

  @IsOptional()
  @IsString()
  workOrderLabelSingularEn?: string;

  @IsOptional()
  @IsString()
  workOrderLabelPluralEn?: string;

  @IsOptional()
  @IsString()
  workOrderLabelSingularAr?: string;

  @IsOptional()
  @IsString()
  workOrderLabelPluralAr?: string;
}
