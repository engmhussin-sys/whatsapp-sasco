import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FuelRequestStatus, SystemRole } from '@prisma/client';
import { FuelRequestsService } from './fuel-requests.service';
import { CreateFuelRequestDto, ActOnFuelRequestDto } from './dto/fuel-requests.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('fuel-requests')
@ApiBearerAuth()
@Controller('companies/:companyId/fuel-requests')
export class FuelRequestsController {
  constructor(private service: FuelRequestsService) {}

  @Post()
  @Roles(SystemRole.WORKER, SystemRole.TEAM_LEAD, SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFuelRequestDto) {
    return this.service.create(companyId, user.sub, dto);
  }

  @Get()
  findAll(
    @TenantId() companyId: string,
    @Query('status') status?: FuelRequestStatus,
    @Query('stationId') stationId?: string,
  ) {
    return this.service.findAll(companyId, { status, stationId });
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
    @Body() dto: ActOnFuelRequestDto,
  ) {
    return this.service.act(companyId, id, user.sub, dto.action, dto.comment);
  }
}
