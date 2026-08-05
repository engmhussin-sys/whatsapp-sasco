import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { AttendanceService } from './attendance.service';
import { CheckInDto, CheckOutDto } from './dto/attendance.dto';

@RequireModule(ModuleCode.ATTENDANCE)
@Controller('companies/:companyId/attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('check-in')
  checkIn(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.attendanceService.checkIn(companyId, user.sub, dto);
  }

  @Post('check-out')
  checkOut(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(companyId, user.sub, dto);
  }

  @Get('me')
  myStatus(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.getMyStatus(companyId, user.sub);
  }

  @Get('today')
  today(@TenantId() companyId: string) {
    return this.attendanceService.listToday(companyId);
  }

  @Get('users/:userId')
  forUser(@TenantId() companyId: string, @Param('userId') userId: string) {
    return this.attendanceService.listForUser(companyId, userId);
  }
}
