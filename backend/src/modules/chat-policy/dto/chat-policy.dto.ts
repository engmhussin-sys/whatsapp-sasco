import { IsBoolean, IsEnum } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class UpsertChatPolicyRuleDto {
  @IsEnum(SystemRole)
  fromRole: SystemRole;

  @IsEnum(SystemRole)
  toRole: SystemRole;

  @IsBoolean()
  allowed: boolean;
}
