import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  MinLength,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskFieldType } from '../task-field-type.enum';

/** Sprint 7 (Form Builder) — simple show-if-equals conditional logic.
 * Deliberately NOT a full expression engine (AND/OR trees, etc.) — that
 * adds real complexity for a use case the design spec itself only ever
 * shows as single-condition field dependencies. Extending to compound
 * conditions later is additive (a new optional field), not a breaking
 * change to this shape. */
export class FieldConditionalLogicDto {
  @IsString()
  dependsOnFieldId: string;

  @IsString()
  showWhenEquals: string;
}

/** Sprint 7 (Form Builder) — validation rules, all optional and only
 * meaningful for the field types they apply to (min/max for NUMBER,
 * minLength/maxLength/pattern for TEXT). Enforcement happens at
 * response-submission time in TaskEngineService, not here — this DTO
 * only carries the RULE definition through template create/update. */
export class FieldValidationRuleDto {
  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsNumber()
  minLength?: number;

  @IsOptional()
  @IsNumber()
  maxLength?: number;

  @IsOptional()
  @IsString()
  pattern?: string;
}

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
  options?: string[]; // for DROPDOWN/RADIO fields

  // Sprint 7 (Form Builder) additions — all optional, so every existing
  // TaskTemplate row (fields stored as plain JSON with none of these
  // keys present) continues to parse and behave exactly as before.
  @IsOptional()
  @IsString()
  sectionId?: string; // groups fields into "Dynamic Sections" in the builder UI

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FieldConditionalLogicDto)
  conditionalLogic?: FieldConditionalLogicDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FieldValidationRuleDto)
  validation?: FieldValidationRuleDto;
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
