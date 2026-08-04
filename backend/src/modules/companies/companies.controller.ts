import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/companies.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  @Roles(SystemRole.SUPER_ADMIN)
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  @Roles(SystemRole.SUPER_ADMIN)
  findAll(@Query('skip') skip: string, @Query('take') take: string) {
    return this.companiesService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get('platform-stats')
  @Roles(SystemRole.SUPER_ADMIN)
  platformStats() {
    return this.companiesService.getPlatformStats();
  }

  @Get('platform-analytics')
  @Roles(SystemRole.SUPER_ADMIN)
  platformAnalytics() {
    return this.companiesService.getPlatformAnalytics();
  }

  @Get(':companyId')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  findOne(@TenantId() companyId: string) {
    return this.companiesService.findOne(companyId);
  }

  @Patch(':companyId')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.COMPANY_ADMIN)
  update(@TenantId() companyId: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(companyId, dto);
  }

  @Get(':companyId/dashboard')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  dashboard(@TenantId() companyId: string) {
    return this.companiesService.getDashboardStats(companyId);
  }
}
