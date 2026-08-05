import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { TrainingService } from './training.service';
import { CreateCertificationDto } from './dto/training.dto';

@RequireModule(ModuleCode.TRAINING)
@Controller('companies/:companyId/certifications')
export class TrainingController {
  constructor(private trainingService: TrainingService) {}

  @Post()
  create(@TenantId() companyId: string, @Body() dto: CreateCertificationDto) {
    return this.trainingService.create(companyId, dto);
  }

  @Get()
  listAll(@TenantId() companyId: string) {
    return this.trainingService.listAll(companyId);
  }

  @Get('users/:userId')
  forUser(@TenantId() companyId: string, @Param('userId') userId: string) {
    return this.trainingService.listForUser(companyId, userId);
  }
}
