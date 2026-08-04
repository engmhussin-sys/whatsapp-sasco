import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole, ModuleCode } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Enforces @RequireModule(...) route metadata — the enforcement half of
 * the Module Marketplace (see CompanyModule in schema.prisma and
 * REQUIRE_MODULE decorator's own doc comment for the full rationale).
 *
 * Fail-CLOSED by design: a route decorated with @RequireModule(X) is
 * blocked unless an ACTIVE CompanyModule row exists for that company +
 * module. This is why the Sprint 1 migration backfills a row for every
 * existing company's current feature set — without that backfill, this
 * guard would immediately lock every existing tenant (including SASCO)
 * out of features they already use the moment it's deployed.
 *
 * SUPER_ADMIN is exempt, matching TenantGuard's own treatment of that
 * role (cross-tenant, not scoped to any single company's module set).
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredModule = this.reflector.getAllAndOverride<ModuleCode>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredModule) return true; // route isn't gated by any module

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return true; // no user yet — JwtAuthGuard/TenantGuard handle that

    if (user.systemRole === SystemRole.SUPER_ADMIN) return true;

    const companyId = request.tenantId ?? user.companyId;
    if (!companyId) return true; // TenantGuard already rejects this case with its own message

    const activation = await this.prisma.companyModule.findUnique({
      where: { companyId_moduleCode: { companyId, moduleCode: requiredModule } },
    });

    if (!activation || !activation.isActive) {
      throw new ForbiddenException(`This company does not have the ${requiredModule} module active`);
    }

    return true;
  }
}
