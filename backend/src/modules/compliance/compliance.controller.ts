import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ModuleCode } from '@prisma/client';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { ComplianceService } from './compliance.service';
import { CreateComplianceRequirementDto, UpdateComplianceRequirementDto } from './dto/compliance.dto';

@RequireModule(ModuleCode.COMPLIANCE)
@Controller('companies/:companyId/compliance')
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Post()
  create(@TenantId() companyId: string, @Body() dto: CreateComplianceRequirementDto) {
    return this.complianceService.create(companyId, dto);
  }

  @Get()
  list(@TenantId() companyId: string) {
    return this.complianceService.list(companyId);
  }

  @Patch(':id')
  update(@TenantId() companyId: string, @Param('id') id: string, @Body() dto: UpdateComplianceRequirementDto) {
    return this.complianceService.update(companyId, id, dto);
  }
}
