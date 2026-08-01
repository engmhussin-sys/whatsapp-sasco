import { IsOptional, IsString } from 'class-validator';

export class CreateInspectionDto {
  @IsString()
  stationId: string;

  @IsString()
  taskTemplateId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
