import { IsArray, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalActionType } from '@prisma/client';

export class CreateApprovalStepDto {
  @IsString()
  name: string;

  @IsString()
  approverRoleId: string;
}

export class CreateApprovalFlowDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  entityType: string; // e.g. "FuelRequest", "TaskResponse" — free-form domain tag

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateApprovalStepDto)
  steps: CreateApprovalStepDto[]; // ordered: index 0 = step 1, etc.
}

export class StartApprovalDto {
  @IsString()
  flowId: string;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;
}

export class ActOnApprovalDto {
  @IsEnum(ApprovalActionType)
  action: ApprovalActionType;

  @IsOptional()
  @IsString()
  comment?: string;
}
