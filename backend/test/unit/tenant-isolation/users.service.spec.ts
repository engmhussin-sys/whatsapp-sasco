import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersService } from '../../../src/modules/users/users.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuthService } from '../../../src/modules/auth/auth.service';

/**
 * These tests simulate the worst case: the TenantGuard is somehow
 * bypassed (bug, misconfiguration, direct service invocation from a
 * background job, etc.) and a caller attempts to reach a resource
 * belonging to a DIFFERENT company than the one passed as tenant
 * context. The service layer's own `where: { companyId }` filtering
 * must independently prevent any cross-tenant read.
 */
describe('UsersService — Defense-in-Depth Tenant Isolation', () => {
  let usersService: UsersService;
  let prisma: { user: any };

  const userBelongingToCompanyB = {
    id: 'user-in-company-b',
    companyId: 'company-B',
    email: 'employee@company-b.com',
    firstName: 'Bilal',
    lastName: 'B',
  };

  beforeEach(async () => {
    prisma = {
      user: {
        // Simulates real Prisma behavior: findFirst returns null when the
        // WHERE clause (id + companyId) doesn't match any row, even if
        // the id alone would have matched a row in a different company.
        findFirst: jest.fn(({ where }: any) => {
          if (where.id === userBelongingToCompanyB.id && where.companyId === 'company-B') {
            return Promise.resolve(userBelongingToCompanyB);
          }
          return Promise.resolve(null);
        }),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: { hashPassword: jest.fn() } },
      ],
    }).compile();

    usersService = moduleRef.get(UsersService);
  });

  it('REJECTS fetching a user by id when the tenant context is a different company', async () => {
    await expect(
      usersService.findOne('company-A', userBelongingToCompanyB.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('ALLOWS fetching the user when the tenant context matches their real company', async () => {
    const result = await usersService.findOne('company-B', userBelongingToCompanyB.id);
    expect(result.id).toBe(userBelongingToCompanyB.id);
  });

  it('always includes companyId in the WHERE clause passed to Prisma', async () => {
    await usersService.findOne('company-B', userBelongingToCompanyB.id).catch(() => {});
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-B' }),
      }),
    );
  });
});
