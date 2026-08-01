import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApprovalActionType } from '@prisma/client';

export class CreateFuelRequestDto {
  @IsString()
  stationId: string;

  @IsString()
  tankId: string;

  @IsNumber()
  currentLevel: number;

  @IsNumber()
  requestedQuantity: number;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Optional override — otherwise the company's active "FuelRequest" ApprovalFlow is used.
  @IsOptional()
  @IsString()
  approvalFlowId?: string;
}

export class ActOnFuelRequestDto {
  @IsEnum(ApprovalActionType)
  action: ApprovalActionType;

  @IsOptional()
  @IsString()
  comment?: string;
}
