import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ShiftManagementService } from '../../../src/modules/shift-management/shift-management.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';
import { TaskEngineService } from '../../../src/modules/task-engine/task-engine.service';

describe('ShiftManagementService — Tenant Isolation on openShiftLog()', () => {
  let service: ShiftManagementService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      shift: { findFirst: jest.fn() },
      station: { findFirst: jest.fn() },
      shiftLog: { findFirst: jest.fn(), create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ShiftManagementService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        { provide: TaskEngineService, useValue: { createTask: jest.fn(), submitResponse: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ShiftManagementService);
  });

  it('REJECTS opening a shift log against a station belonging to a different company', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-1', name: 'Morning' });
    prisma.station.findFirst.mockResolvedValue(null); // scoped lookup found nothing — station belongs elsewhere

    await expect(
      service.openShiftLog('company-A', 'worker-1', {
        shiftId: 'shift-1',
        stationId: 'station-belonging-to-company-B',
      }),
    ).rejects.toThrow(NotFoundException);

    // Confirms the lookup was actually scoped by companyId, not just id.
    expect(prisma.station.findFirst).toHaveBeenCalledWith({
      where: { id: 'station-belonging-to-company-B', companyId: 'company-A' },
    });
  });

  it('ALLOWS opening a shift log when the station belongs to the same company', async () => {
    prisma.shift.findFirst.mockResolvedValue({ id: 'shift-1', name: 'Morning' });
    prisma.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prisma.shiftLog.findFirst.mockResolvedValue(null); // no already-open log
    prisma.shiftLog.create.mockResolvedValue({ id: 'log-1', status: 'OPEN' });

    const result = await service.openShiftLog('company-A', 'worker-1', {
      shiftId: 'shift-1',
      stationId: 'station-1',
    });

    expect(result.id).toBe('log-1');
  });
});
