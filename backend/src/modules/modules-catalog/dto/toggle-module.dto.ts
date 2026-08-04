import { IsEnum } from 'class-validator';
import { ModuleCode } from '@prisma/client';

export class ToggleModuleDto {
  @IsEnum(ModuleCode)
  moduleCode: ModuleCode;
}
