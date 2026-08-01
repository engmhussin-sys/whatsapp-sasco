import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SystemRole } from '@prisma/client';
import { CompanyDictionaryService } from './company-dictionary.service';
import { UpsertDictionaryTermDto } from './dto/company-dictionary.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';

@ApiTags('company-dictionary')
@ApiBearerAuth()
@Controller('companies/:companyId/dictionary')
export class CompanyDictionaryController {
  constructor(private service: CompanyDictionaryService) {}

  @Post()
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  upsert(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertDictionaryTermDto) {
    return this.service.upsertTerm(companyId, user.sub, dto);
  }

  @Get()
  findAll(@TenantId() companyId: string) {
    return this.service.findAll(companyId);
  }

  @Delete(':id')
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  remove(@TenantId() companyId: string, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(companyId, id, user.sub);
  }
}
