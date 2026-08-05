import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum ComplianceStatusDto {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export class CreateComplianceRequirementDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}

export class UpdateComplianceRequirementDto {
  @IsOptional()
  @IsEnum(ComplianceStatusDto)
  status?: ComplianceStatusDto;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}
