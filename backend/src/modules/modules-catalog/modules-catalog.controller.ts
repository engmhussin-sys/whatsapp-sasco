import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user.interface';
import { ModulesCatalogService } from './modules-catalog.service';
import { EntitlementsService, EntitlementChange } from './entitlements.service';
import { ToggleModuleDto } from './dto/toggle-module.dto';
import { PreviewEntitlementChangesDto } from './dto/preview-entitlement-changes.dto';
import { MODULE_CATALOG } from './module-catalog.data';

@Controller()
export class ModulesCatalogController {
  constructor(
    private modulesService: ModulesCatalogService,
    private entitlementsService: EntitlementsService,
  ) {}

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

  // Sprint 4 — entitlements (co_entitle screen). Super Admin only: this
  // is the platform-owner-facing view of a company's plan/module
  // economics, not something a Company Admin manages directly here.
  @Roles(SystemRole.SUPER_ADMIN)
  @Get('companies/:companyId/entitlements')
  getEntitlementSummary(@TenantId() companyId: string) {
    return this.entitlementsService.getEntitlementSummary(companyId);
  }

  @Roles(SystemRole.SUPER_ADMIN)
  @Post('companies/:companyId/entitlements/preview')
  previewEntitlementChanges(@TenantId() companyId: string, @Body() dto: PreviewEntitlementChangesDto) {
    return this.entitlementsService.previewChanges(companyId, dto.changes as EntitlementChange[]);
  }

  @Roles(SystemRole.SUPER_ADMIN)
  @Post('companies/:companyId/entitlements/apply')
  applyEntitlementChanges(
    @TenantId() companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PreviewEntitlementChangesDto,
  ) {
    return this.entitlementsService.applyChanges(companyId, dto.changes as EntitlementChange[], user.sub);
  }
}
