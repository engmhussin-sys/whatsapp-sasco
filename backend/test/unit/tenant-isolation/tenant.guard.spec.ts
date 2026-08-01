import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@prisma/client';
import { TenantGuard } from '../../../src/common/guards/tenant.guard';

function buildContext(params: { user: any; routeParams: Record<string, string> }) {
  const request: any = { user: params.user, params: params.routeParams };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    __request: request,
  } as any;
}

describe('TenantGuard — Multi-Tenant Isolation', () => {
  let guard: TenantGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false); // not a @Public() route
    guard = new TenantGuard(reflector);
  });

  it('BLOCKS a Company Admin of Company A from addressing Company B via the URL', () => {
    const companyAAdmin = {
      sub: 'admin-a',
      companyId: 'company-A',
      systemRole: SystemRole.COMPANY_ADMIN,
      email: 'admin@a.com',
    };
    const ctx = buildContext({
      user: companyAAdmin,
      routeParams: { companyId: 'company-B' }, // attacker tampers with the URL
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('BLOCKS a Worker of Company A from addressing Company B via the URL', () => {
    const companyAWorker = {
      sub: 'worker-a',
      companyId: 'company-A',
      systemRole: SystemRole.WORKER,
      email: 'worker@a.com',
    };
    const ctx = buildContext({
      user: companyAWorker,
      routeParams: { companyId: 'company-B' },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('ALLOWS a Company Admin to address their OWN company and sets request.tenantId from the JWT', () => {
    const companyAAdmin = {
      sub: 'admin-a',
      companyId: 'company-A',
      systemRole: SystemRole.COMPANY_ADMIN,
      email: 'admin@a.com',
    };
    const ctx = buildContext({
      user: companyAAdmin,
      routeParams: { companyId: 'company-A' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.__request.tenantId).toBe('company-A'); // derived from JWT, not the URL
  });

  it('ALLOWS a Super Admin to address ANY company (cross-tenant is legitimate for this role)', () => {
    const superAdmin = {
      sub: 'root',
      companyId: null,
      systemRole: SystemRole.SUPER_ADMIN,
      email: 'root@platform.com',
    };
    const ctx = buildContext({
      user: superAdmin,
      routeParams: { companyId: 'company-B' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.__request.tenantId).toBeNull(); // services must scope explicitly per request
  });

  it('REJECTS a non-Super-Admin user who somehow has no companyId', () => {
    const orphanUser = {
      sub: 'ghost',
      companyId: null,
      systemRole: SystemRole.WORKER,
      email: 'ghost@nowhere.com',
    };
    const ctx = buildContext({ user: orphanUser, routeParams: {} });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
