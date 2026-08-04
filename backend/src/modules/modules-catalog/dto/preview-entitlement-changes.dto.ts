import { IsArray, IsEnum, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ModuleCode } from '@prisma/client';

class EntitlementChangeDto {
  @IsEnum(ModuleCode)
  moduleCode: ModuleCode;

  @IsIn(['activate', 'deactivate'])
  action: 'activate' | 'deactivate';
}

export class PreviewEntitlementChangesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntitlementChangeDto)
  changes: EntitlementChangeDto[];
}
