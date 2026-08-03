import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('companies/:companyId/reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('overview')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN, SystemRole.TEAM_LEAD)
  companyOverview(@TenantId() companyId: string) {
    return this.reports.companyOverview(companyId);
  }

  @Get('billing')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  billingOverview(@TenantId() companyId: string) {
    return this.reports.billingOverview(companyId);
  }

  @Get('translation')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  translationOverview(@TenantId() companyId: string, @Query('days') days?: string) {
    return this.reports.translationOverview(companyId, days ? parseInt(days, 10) : undefined);
  }
}

/** Platform-wide reports live under a separate, non-tenant-scoped path — see PlatformReportsController below. */
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class PlatformReportsController {
  constructor(private reports: ReportsService) {}

  @Get('platform-overview')
  @Roles(SystemRole.SUPER_ADMIN)
  platformOverview() {
    return this.reports.platformOverview();
  }
}
