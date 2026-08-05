import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from '../../../src/modules/attendance/attendance.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;

  const companyId = 'company-A';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      attendanceRecord: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AttendanceService);
  });

  describe('checkIn', () => {
    it('creates a new record when no open check-in exists', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      await service.checkIn(companyId, userId, { latitude: 24.7, longitude: 46.6 });

      expect(prisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: { companyId, userId, checkInLat: 24.7, checkInLng: 46.6, stationId: undefined },
      });
    });

    it('rejects a second check-in while one is already open', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'existing', checkOutAt: null });

      await expect(service.checkIn(companyId, userId, {})).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceRecord.create).not.toHaveBeenCalled();
    });
  });

  describe('checkOut', () => {
    it('closes the most recent open record', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'rec-1', checkOutAt: null });

      await service.checkOut(companyId, userId, { latitude: 24.7, longitude: 46.6 });

      expect(prisma.attendanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
        data: { checkOutAt: expect.any(Date), checkOutLat: 24.7, checkOutLng: 46.6 },
      });
    });

    it('rejects checking out with no open check-in', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);

      await expect(service.checkOut(companyId, userId, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyStatus', () => {
    it('reports checkedIn=true when an open record exists', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue({ id: 'rec-1', checkOutAt: null });
      expect(await service.getMyStatus(companyId, userId)).toEqual({ checkedIn: true, record: { id: 'rec-1', checkOutAt: null } });
    });

    it('reports checkedIn=false when no open record exists', async () => {
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);
      expect(await service.getMyStatus(companyId, userId)).toEqual({ checkedIn: false, record: null });
    });
  });
});
