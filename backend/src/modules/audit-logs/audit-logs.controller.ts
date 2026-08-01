import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { AuditLogsService } from './audit-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Controller('companies/:companyId/audit-logs')
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  findAll(
    @TenantId() companyId: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('entityType') entityType: string,
  ) {
    return this.auditLogsService.findForCompany(companyId, {
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      entityType,
    });
  }
}
