import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskFieldType } from '../task-field-type.enum';

export class TaskFieldDefinitionDto {
  @IsString()
  id: string; // stable id referenced by TaskResponse.answers and TaskAttachment.fieldId

  @IsEnum(TaskFieldType)
  type: TaskFieldType;

  @IsString()
  label: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]; // for DROPDOWN fields
}

export class CreateTaskTemplateDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  domainTag?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskFieldDefinitionDto)
  fields: TaskFieldDefinitionDto[];

  @IsOptional()
  @IsString()
  approvalFlowId?: string;
}

export class UpdateTaskTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaskFieldDefinitionDto)
  fields?: TaskFieldDefinitionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  templateId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  dueAt?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];
}

export class SubmitTaskResponseDto {
  @IsObject()
  answers: Record<string, unknown>; // { [fieldId]: value }
}
