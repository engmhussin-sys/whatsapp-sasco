import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { ApprovalEngineService } from './approval-engine.service';
import { CreateApprovalFlowDto, StartApprovalDto, ActOnApprovalDto } from './dto/approval-engine.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('approval-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/approval-flows')
export class ApprovalFlowsController {
  constructor(private service: ApprovalEngineService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateApprovalFlowDto) {
    return this.service.createFlow(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.service.findAllFlows(companyId);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findFlow(companyId, id);
  }
}

@ApiTags('approval-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/approvals')
export class ApprovalsController {
  constructor(private service: ApprovalEngineService) {}

  @Post()
  start(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: StartApprovalDto) {
    return this.service.startApproval(companyId, user.sub, dto);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post(':id/actions')
  act(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ActOnApprovalDto,
  ) {
    return this.service.act(companyId, id, user.sub, dto.action, dto.comment);
  }
}
