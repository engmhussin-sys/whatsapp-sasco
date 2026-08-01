import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { StationsService } from './stations.service';
import { CreateStationDto, CreateTankDto, UpdateTankLevelDto } from './dto/stations.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('stations')
@ApiBearerAuth()
@Controller('companies/:companyId/stations')
export class StationsController {
  constructor(private service: StationsService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStationDto) {
    return this.service.create(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post(':id/tanks')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  addTank(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTankDto,
  ) {
    return this.service.addTank(companyId, id, user.sub, dto);
  }

  @Patch('tanks/:tankId/level')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.WORKER, SystemRole.SUPER_ADMIN)
  updateTankLevel(
    @TenantId() companyId: string,
    @Param('tankId') tankId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTankLevelDto,
  ) {
    return this.service.updateTankLevel(companyId, tankId, user.sub, dto);
  }
}
