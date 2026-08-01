import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SystemRole } from '@prisma/client';

/**
 * SECURITY-CRITICAL DECORATOR
 * -----------------------------------------------------------------------
 * Returns the tenant id that a request is authorized to operate on.
 *
 * - For COMPANY_ADMIN / TEAM_LEAD / WORKER: ALWAYS returns
 *   `request.tenantId`, which TenantGuard derived from the user's JWT
 *   payload (`user.companyId`). The route's `:companyId` param, if any,
 *   is never trusted as the source of truth — TenantGuard already
 *   verifies it matches, but this decorator ensures every service call
 *   is driven by the JWT-derived value, not the URL.
 *
 * - For SUPER_ADMIN: the JWT carries no companyId (cross-tenant access
 *   is legitimate), so the explicit `:companyId` route param IS the
 *   source of truth for which tenant the operation targets. This is the
 *   ONLY case where a client-supplied id is used, and only because the
 *   caller's platform-level role was itself verified from the JWT.
 *
 * Usage: replace `@Param('companyId')` with `@TenantId()` in every
 * controller method that touches tenant-scoped data.
 */
export const TenantId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;

  if (user?.systemRole === SystemRole.SUPER_ADMIN) {
    const routeCompanyId = request.params?.companyId;
    if (!routeCompanyId) {
      throw new ForbiddenException('companyId route parameter is required for Super Admin requests');
    }
    return routeCompanyId;
  }

  if (!request.tenantId) {
    throw new ForbiddenException('No tenant context on request');
  }
  return request.tenantId;
});
