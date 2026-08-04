import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ModulesCatalogService } from './modules-catalog.service';
import { ToggleModuleDto } from './dto/toggle-module.dto';
import { MODULE_CATALOG } from './module-catalog.data';

@Controller()
export class ModulesCatalogController {
  constructor(private modulesService: ModulesCatalogService) {}

  /** The full platform catalog — same for everyone, no auth-scoping needed
   * beyond just being logged in (handled by the global JwtAuthGuard). */
  @Get('modules/catalog')
  getCatalog() {
    return MODULE_CATALOG;
  }

  @Get('companies/:companyId/modules')
  getCompanyModules(@TenantId() companyId: string) {
    return this.modulesService.getCompanyModules(companyId);
  }

  // Activation is Company Admin / Super Admin only — matches the
  // vision's "Company should enable or disable modules" while keeping
  // ordinary workers/team leads from silently toggling paid features.
  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  @Post('companies/:companyId/modules/activate')
  activate(@TenantId() companyId: string, @CurrentUser() user: AuthenticatedUser, @Body() dto: ToggleModuleDto) {
    return this.modulesService.activate(companyId, dto.moduleCode, user.sub);
  }

  @Roles(SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN)
  @Patch('companies/:companyId/modules/deactivate')
  deactivate(@TenantId() companyId: string, @Body() dto: ToggleModuleDto) {
    return this.modulesService.deactivate(companyId, dto.moduleCode);
  }
}
