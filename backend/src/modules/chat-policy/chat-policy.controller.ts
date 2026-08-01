import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { ChatPolicyService } from './chat-policy.service';
import { UpsertChatPolicyRuleDto } from './dto/chat-policy.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('chat-policy')
@ApiBearerAuth()
@Controller('companies/:companyId/chat-policy-rules')
export class ChatPolicyController {
  constructor(private service: ChatPolicyService) {}

  @Get()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  list(@TenantId() companyId: string) {
    return this.service.listRules(companyId);
  }

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  upsert(@TenantId() companyId: string, @Body() dto: UpsertChatPolicyRuleDto) {
    return this.service.upsertRule(companyId, dto.fromRole, dto.toRole, dto.allowed);
  }
}
