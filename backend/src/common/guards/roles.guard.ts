import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.interface';

/**
 * Enforces @Roles(...) route metadata against the authenticated user's
 * SystemRole. Fine-grained per-action permission checks (custom Role/
 * Permission entities defined in the DB) are handled separately inside
 * the roles-permissions module's PermissionsService and used explicitly
 * where a route needs @RequirePermissions() checks beyond the coarse
 * SystemRole tiers.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return false;

    const allowed = requiredRoles.includes(user.systemRole);
    if (!allowed) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
