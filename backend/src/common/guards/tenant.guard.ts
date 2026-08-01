import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * TENANT ISOLATION GUARD
 * -----------------------------------------------------------------------
 * This is the backbone of multi-tenant data isolation. It runs after
 * JwtAuthGuard and before RolesGuard, and does two things:
 *
 * 1. For SUPER_ADMIN users (companyId === null): allows the request
 *    through untouched — Super Admin routes operate across all tenants
 *    and must explicitly filter by a companyId route/query param when
 *    they need to scope to one company.
 *
 * 2. For all other roles: attaches `request.tenantId = user.companyId`
 *    and REQUIRES that any :companyId route param, if present, matches
 *    the authenticated user's own companyId. This prevents a Company
 *    Admin or Worker of Company A from ever addressing Company B's data
 *    by manipulating the URL/body, even if a service method forgets to
 *    filter — it is a defense-in-depth layer on top of Prisma-level
 *    `where: { companyId }` filtering that must ALSO be applied in
 *    every service (see modules/**\/*.service.ts).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return true; // no user yet (shouldn't happen post-JwtAuthGuard)

    if (user.systemRole === SystemRole.SUPER_ADMIN) {
      request.tenantId = null; // cross-tenant access, services must scope explicitly
      return true;
    }

    if (!user.companyId) {
      throw new ForbiddenException('User is not associated with any company');
    }

    request.tenantId = user.companyId;

    // If the route addresses a specific company explicitly, enforce match.
    const routeCompanyId = request.params?.companyId;
    if (routeCompanyId && routeCompanyId !== user.companyId) {
      throw new ForbiddenException('Cross-tenant access is not permitted');
    }

    return true;
  }
}
