import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { SystemRole } from '@prisma/client';
import { LanguagesService } from './languages.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Public } from '../../common/decorators/public.decorator';

class EnableLanguageDto {
  @IsString()
  langCode: string;
}

@ApiTags('languages')
@Controller('languages')
export class LanguagesController {
  constructor(private languagesService: LanguagesService) {}

  @Public()
  @Get()
  findAll() {
    return this.languagesService.findAll();
  }
}

@ApiTags('languages')
@ApiBearerAuth()
@Controller('companies/:companyId/languages')
export class CompanyLanguagesController {
  constructor(private languagesService: LanguagesService) {}

  @Get()
  findForCompany(@TenantId() companyId: string) {
    return this.languagesService.findForCompany(companyId);
  }

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  enable(@TenantId() companyId: string, @Body() dto: EnableLanguageDto) {
    return this.languagesService.enableForCompany(companyId, dto.langCode);
  }

  @Delete(':langCode')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  disable(@TenantId() companyId: string, @Param('langCode') langCode: string) {
    return this.languagesService.disableForCompany(companyId, langCode);
  }
}
