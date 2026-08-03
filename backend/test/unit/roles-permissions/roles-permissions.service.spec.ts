import { Test } from '@nestjs/testing';
import { RolesPermissionsService } from '../../../src/modules/roles-permissions/roles-permissions.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';

describe('RolesPermissionsService.findAllPermissions()', () => {
  let service: RolesPermissionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { permission: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesPermissionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(RolesPermissionsService);
  });

  it('returns the full platform-wide permission catalog ordered by code', async () => {
    prisma.permission.findMany.mockResolvedValue([{ code: 'billing.view' }, { code: 'users.create' }]);

    const result = await service.findAllPermissions();

    expect(prisma.permission.findMany).toHaveBeenCalledWith({ orderBy: { code: 'asc' } });
    expect(result).toHaveLength(2);
  });
});
