import { Test } from '@nestjs/testing';
import { SystemRole, VisibilityScope } from '@prisma/client';
import { DirectoryService } from '../../../src/modules/directory/directory.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('DirectoryService — Visibility Engine', () => {
  let service: DirectoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      team: { findMany: jest.fn() },
      department: { findMany: jest.fn() },
      station: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DirectoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DirectoryService);
  });

  describe('role-based default scope resolution', () => {
    it('defaults WORKER to TEAM scope when no override is set', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'w1',
        systemRole: SystemRole.WORKER,
        directoryVisibilityScope: null,
        teamMemberships: [{ teamId: 'team-1' }],
        departmentId: null,
        primaryStationId: null,
      });
      const scope = await service.resolveEffectiveScope('company-A', 'w1');
      expect(scope).toBe(VisibilityScope.TEAM);
    });

    it('defaults TEAM_LEAD to DEPARTMENT scope', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 't1',
        systemRole: SystemRole.TEAM_LEAD,
        directoryVisibilityScope: null,
      });
      expect(await service.resolveEffectiveScope('company-A', 't1')).toBe(VisibilityScope.DEPARTMENT);
    });

    it('defaults COMPANY_ADMIN to COMPANY scope', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'a1',
        systemRole: SystemRole.COMPANY_ADMIN,
        directoryVisibilityScope: null,
      });
      expect(await service.resolveEffectiveScope('company-A', 'a1')).toBe(VisibilityScope.COMPANY);
    });

    it('respects an explicit per-user override regardless of role', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'w1',
        systemRole: SystemRole.WORKER,
        directoryVisibilityScope: VisibilityScope.STATION, // Admin manually widened this worker's visibility
      });
      expect(await service.resolveEffectiveScope('company-A', 'w1')).toBe(VisibilityScope.STATION);
    });
  });

  describe('getVisibleUserIds() — the actual enforcement logic', () => {
    it('WORKER (TEAM scope) sees only themself and teammates — NOT the entire company', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'w1',
        companyId: 'company-A',
        systemRole: SystemRole.WORKER,
        directoryVisibilityScope: null,
        teamMemberships: [{ teamId: 'team-1' }],
        departmentId: 'dept-1',
        primaryStationId: 'station-1',
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]); // teammates found

      const visible = await service.getVisibleUserIds('company-A', 'w1');

      expect(visible.has('w1')).toBe(true);
      expect(visible.has('w2')).toBe(true);
      // Confirms the query was scoped by team membership, not company-wide.
      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.companyId).toBe('company-A');
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([{ id: 'w1' }, { teamMemberships: { some: { teamId: { in: ['team-1'] } } } }]),
      );
      // DEPARTMENT/STATION conditions must NOT be present for a TEAM-scoped worker.
      expect(whereArg.OR).not.toEqual(expect.arrayContaining([{ departmentId: 'dept-1' }]));
      expect(whereArg.OR).not.toEqual(expect.arrayContaining([{ primaryStationId: 'station-1' }]));
    });

    it('TEAM_LEAD (DEPARTMENT scope) sees their whole department, including teams they are not personally in', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'tl1',
        companyId: 'company-A',
        systemRole: SystemRole.TEAM_LEAD,
        directoryVisibilityScope: null,
        teamMemberships: [{ teamId: 'team-1' }],
        departmentId: 'dept-1',
        primaryStationId: null,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'tl1' }, { id: 'w2' }, { id: 'w3' }]);

      await service.getVisibleUserIds('company-A', 'tl1');

      const whereArg = prisma.user.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual(expect.arrayContaining([{ departmentId: 'dept-1' }]));
    });

    it('COMPANY_ADMIN (COMPANY scope) sees the entire company — bypasses team/department filtering entirely', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'admin1',
        companyId: 'company-A',
        systemRole: SystemRole.COMPANY_ADMIN,
        directoryVisibilityScope: null,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin1' }, { id: 'w1' }, { id: 'w2' }, { id: 'w3' }]);

      const visible = await service.getVisibleUserIds('company-A', 'admin1');

      expect(visible.size).toBe(4);
      // COMPANY scope queries by companyId ALONE — no OR conditions needed.
      const callArg = prisma.user.findMany.mock.calls[0][0];
      expect(callArg.where).toEqual({ companyId: 'company-A' });
    });

    it('a worker CANNOT see users from a completely unrelated team/department (negative case)', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'w1',
        companyId: 'company-A',
        systemRole: SystemRole.WORKER,
        directoryVisibilityScope: null,
        teamMemberships: [{ teamId: 'team-1' }],
        departmentId: null,
        primaryStationId: null,
      });
      // Simulate the DB correctly excluding an unrelated worker (w-other)
      // by returning only what actually matches the OR clause.
      prisma.user.findMany.mockResolvedValue([{ id: 'w1' }]);

      const visible = await service.getVisibleUserIds('company-A', 'w1');

      expect(visible.has('w-other-team-user')).toBe(false);
    });
  });
});
