import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ModuleCode, SystemRole } from '@prisma/client';
import { ModuleGuard } from '../../../src/common/guards/module.guard';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

function buildContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ModuleGuard', () => {
  let guard: ModuleGuard;
  let reflector: any;
  let prisma: any;

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { companyModule: { findUnique: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [ModuleGuard, { provide: Reflector, useValue: reflector }, { provide: PrismaService, useValue: prisma }],
    }).compile();

    guard = moduleRef.get(ModuleGuard);
  });

  it('allows a route with no @RequireModule() metadata through unconditionally', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    const ctx = buildContext({ user: { systemRole: SystemRole.WORKER, companyId: 'c1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.companyModule.findUnique).not.toHaveBeenCalled();
  });

  it('ALWAYS allows SUPER_ADMIN through, regardless of any company\'s module state', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(ModuleCode.SAFETY);
    const ctx = buildContext({ user: { systemRole: SystemRole.SUPER_ADMIN, companyId: null } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.companyModule.findUnique).not.toHaveBeenCalled();
  });

  it('allows a worker through when the required module IS active for their company', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(ModuleCode.SAFETY);
    prisma.companyModule.findUnique.mockResolvedValue({ isActive: true });
    const ctx = buildContext({ tenantId: 'c1', user: { systemRole: SystemRole.WORKER, companyId: 'c1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('BLOCKS a worker when no CompanyModule row exists at all for that module (fail-closed)', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(ModuleCode.SAFETY);
    prisma.companyModule.findUnique.mockResolvedValue(null);
    const ctx = buildContext({ tenantId: 'c1', user: { systemRole: SystemRole.WORKER, companyId: 'c1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('BLOCKS a worker when the module row exists but is explicitly inactive', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(ModuleCode.SAFETY);
    prisma.companyModule.findUnique.mockResolvedValue({ isActive: false });
    const ctx = buildContext({ tenantId: 'c1', user: { systemRole: SystemRole.WORKER, companyId: 'c1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow('This company does not have the SAFETY module active');
  });

  it('uses request.tenantId (JWT-derived, set by TenantGuard) rather than trusting any client-supplied value', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(ModuleCode.SAFETY);
    prisma.companyModule.findUnique.mockResolvedValue({ isActive: true });
    const ctx = buildContext({ tenantId: 'trusted-company', user: { systemRole: SystemRole.WORKER, companyId: 'trusted-company' } });

    await guard.canActivate(ctx);

    expect(prisma.companyModule.findUnique).toHaveBeenCalledWith({
      where: { companyId_moduleCode: { companyId: 'trusted-company', moduleCode: ModuleCode.SAFETY } },
    });
  });
});
