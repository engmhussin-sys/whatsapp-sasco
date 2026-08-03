import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { HazardStatus, SystemRole } from '@prisma/client';
import { SafetyService } from './safety.service';
import { ReportHazardDto, UpdateHazardStatusDto, RaiseSosDto } from './dto/safety.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

const MAX_HAZARD_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@ApiTags('safety')
@ApiBearerAuth()
@Controller('companies/:companyId')
export class SafetyController {
  constructor(private safety: SafetyService) {}

  /** Upload FIRST, get a URL, then include it in POST .../hazards below. */
  @Post('hazards/photo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_HAZARD_PHOTO_SIZE_BYTES } }))
  uploadHazardPhoto(@TenantId() companyId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return this.safety.uploadHazardPhoto(companyId, file);
  }

  @Post('hazards')
  reportHazard(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ReportHazardDto) {
    return this.safety.reportHazard(companyId, user.sub, dto.kind, dto.stationId, dto.note, dto.photoUrl, dto.audioUrl);
  }

  @Get('hazards')
  listHazards(@TenantId() companyId: string, @Query('status') status?: HazardStatus) {
    return this.safety.listHazards(companyId, status);
  }

  @Patch('hazards/:id/status')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  updateHazardStatus(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateHazardStatusDto) {
    return this.safety.updateHazardStatus(companyId, id, dto.status);
  }

  @Post('sos')
  raiseSos(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: RaiseSosDto) {
    return this.safety.raiseSos(companyId, user.sub, dto.stationId, dto.latitude, dto.longitude);
  }

  @Get('sos')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  listActiveSos(@TenantId() companyId: string) {
    return this.safety.listActiveSos(companyId);
  }

  @Patch('sos/:id/resolve')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  resolveSos(@TenantId() companyId: string, @Param('id') id: string) {
    return this.safety.resolveSos(companyId, id);
  }
}
