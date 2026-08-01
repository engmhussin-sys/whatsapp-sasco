import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { InspectionsService } from './inspections.service';
import { CreateInspectionDto } from './dto/inspections.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('inspections')
@ApiBearerAuth()
@Controller('companies/:companyId/inspections')
export class InspectionsController {
  constructor(private service: InspectionsService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInspectionDto) {
    return this.service.create(companyId, user.sub, dto);
  }

  @Get()
  findAllForStation(@TenantId() companyId: string, @Query('stationId') stationId: string) {
    return this.service.findAllForStation(companyId, stationId);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }
}
