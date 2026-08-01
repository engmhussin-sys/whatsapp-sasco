import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { ShiftManagementService } from './shift-management.service';
import { CreateShiftDto, OpenShiftLogDto, CloseShiftLogDto } from './dto/shift-management.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('shift-management')
@ApiBearerAuth()
@Controller('companies/:companyId/shifts')
export class ShiftsController {
  constructor(private service: ShiftManagementService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShiftDto) {
    return this.service.createShift(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.service.findAllShifts(companyId);
  }
}

@ApiTags('shift-management')
@ApiBearerAuth()
@Controller('companies/:companyId/shift-logs')
export class ShiftLogsController {
  constructor(private service: ShiftManagementService) {}

  @Post('open')
  open(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: OpenShiftLogDto) {
    return this.service.openShiftLog(companyId, user.sub, dto);
  }

  @Post(':id/close')
  close(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CloseShiftLogDto,
  ) {
    return this.service.closeShiftLog(companyId, id, user.sub, dto);
  }

  @Get('mine')
  mine(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findLogsForUser(companyId, user.sub);
  }
}
