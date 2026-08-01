import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { RolesGuard } from '../../../src/common/guards/roles.guard';

function buildContext(user: any, requiredRoles: SystemRole[] | undefined, isPublic = false) {
  const request: any = { user };
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: string) => (key === 'isPublic' ? isPublic : requiredRoles));

  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;

  return { ctx, reflector };
}

describe('RolesGuard — Permission Enforcement', () => {
  it('DENIES a Worker calling a route restricted to COMPANY_ADMIN/SUPER_ADMIN', () => {
    const worker = { sub: 'w1', companyId: 'company-A', systemRole: SystemRole.WORKER, email: 'w@a.com' };
    const { ctx, reflector } = buildContext(worker, [SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('DENIES a Team Lead calling a route restricted to COMPANY_ADMIN only', () => {
    const teamLead = { sub: 't1', companyId: 'company-A', systemRole: SystemRole.TEAM_LEAD, email: 't@a.com' };
    const { ctx, reflector } = buildContext(teamLead, [SystemRole.COMPANY_ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('ALLOWS a Company Admin calling a route restricted to COMPANY_ADMIN/SUPER_ADMIN', () => {
    const admin = { sub: 'a1', companyId: 'company-A', systemRole: SystemRole.COMPANY_ADMIN, email: 'a@a.com' };
    const { ctx, reflector } = buildContext(admin, [SystemRole.COMPANY_ADMIN, SystemRole.SUPER_ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ALLOWS any authenticated role when the route declares no @Roles() restriction', () => {
    const worker = { sub: 'w1', companyId: 'company-A', systemRole: SystemRole.WORKER, email: 'w@a.com' };
    const { ctx, reflector } = buildContext(worker, undefined);
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('a Super Admin is NOT implicitly exempt from @Roles() checks (must be listed explicitly)', () => {
    const superAdmin = { sub: 'root', companyId: null, systemRole: SystemRole.SUPER_ADMIN, email: 'root@platform.com' };
    // A hypothetical route restricted only to COMPANY_ADMIN, deliberately excluding SUPER_ADMIN.
    const { ctx, reflector } = buildContext(superAdmin, [SystemRole.COMPANY_ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
