import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { SystemRole, TaskStatus, AttachmentKind } from '@prisma/client';
import { TaskEngineService } from './task-engine.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CreateTaskDto,
  SubmitTaskResponseDto,
} from './dto/task-engine.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { STORAGE_PROVIDER, StorageProvider } from '../../common/storage/storage.interface';
import { Inject } from '@nestjs/common';

@ApiTags('task-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/task-templates')
export class TaskTemplatesController {
  constructor(private service: TaskEngineService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskTemplateDto) {
    return this.service.createTemplate(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string, @Query('domainTag') domainTag?: string) {
    return this.service.findAllTemplates(companyId, domainTag);
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findTemplate(companyId, id);
  }

  @Patch(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateTaskTemplateDto) {
    return this.service.updateTemplate(companyId, id, dto);
  }
}

@ApiTags('task-engine')
@ApiBearerAuth()
@Controller('companies/:companyId/tasks')
export class TasksController {
  constructor(
    private service: TaskEngineService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD, SystemRole.SUPER_ADMIN)
  create(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTaskDto) {
    return this.service.createTask(companyId, user.sub, dto);
  }

  @Get()
  findAll(
    @TenantId() companyId: string,
    @Query('status') status?: TaskStatus,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.service.findAllTasks(companyId, { status, assignedToUserId, teamId });
  }

  @Get(':id')
  findOne(@TenantId() companyId: string, @Param('id') id: string) {
    return this.service.findTask(companyId, id);
  }

  @Post(':id/responses')
  submitResponse(
    @TenantId() companyId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitTaskResponseDto,
  ) {
    return this.service.submitResponse(companyId, id, user.sub, dto);
  }

  @Post('responses/:responseId/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async addAttachment(
    @TenantId() companyId: string,
    @Param('responseId') responseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('fieldId') fieldId: string,
    @Body('kind') kind: AttachmentKind,
    @Body('gpsLat') gpsLat?: string,
    @Body('gpsLng') gpsLng?: string,
  ) {
    if (!file) throw new BadRequestException('file is required');
    if (!fieldId) throw new BadRequestException('fieldId is required');

    const stored = await this.storage.save(file.buffer, {
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: `task-attachments/${companyId}`,
    });

    return this.service.addAttachmentToResponse(
      companyId,
      responseId,
      fieldId,
      kind ?? AttachmentKind.DOCUMENT,
      stored,
      gpsLat && gpsLng ? { lat: parseFloat(gpsLat), lng: parseFloat(gpsLng) } : undefined,
    );
  }
}
