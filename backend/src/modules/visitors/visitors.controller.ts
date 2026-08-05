import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { VisitorsService } from './visitors.service';
import { CheckInVisitorDto } from './dto/visitors.dto';

@RequireModule(ModuleCode.VISITOR_MANAGEMENT)
@Controller('companies/:companyId/visitors')
export class VisitorsController {
  constructor(private visitorsService: VisitorsService) {}

  @Post('check-in')
  checkIn(@TenantId() companyId: string, @Body() dto: CheckInVisitorDto) {
    return this.visitorsService.checkIn(companyId, dto);
  }

  @Post(':visitorId/check-out')
  checkOut(@TenantId() companyId: string, @Param('visitorId') visitorId: string) {
    return this.visitorsService.checkOut(companyId, visitorId);
  }

  @Get('on-site')
  onSite(@TenantId() companyId: string) {
    return this.visitorsService.listOnSite(companyId);
  }

  @Get('today')
  today(@TenantId() companyId: string) {
    return this.visitorsService.listToday(companyId);
  }
}
