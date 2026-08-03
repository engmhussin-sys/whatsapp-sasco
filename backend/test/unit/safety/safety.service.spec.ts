import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HazardStatus, SystemRole } from '@prisma/client';
import { SafetyService } from '../../../src/modules/safety/safety.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';
import { ChatGateway } from '../../../src/modules/websocket/chat.gateway';

describe('SafetyService', () => {
  let service: SafetyService;
  let prisma: any;
  let notifications: any;
  let chatGateway: any;

  beforeEach(async () => {
    prisma = {
      hazardReport: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      sosAlert: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    chatGateway = { server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: ChatGateway, useValue: chatGateway },
      ],
    }).compile();

    service = moduleRef.get(SafetyService);
  });

  describe('reportHazard()', () => {
    it('creates a hazard report with the given kind and optional fields, including audioUrl', async () => {
      prisma.hazardReport.create.mockResolvedValue({ id: 'h1' });
      await service.reportHazard('company-A', 'user-1', 'FUEL_LEAK', 'station-1', 'تسرب صغير', 'https://x/photo.jpg', 'https://x/note.m4a');
      expect(prisma.hazardReport.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-A',
          reportedById: 'user-1',
          kind: 'FUEL_LEAK',
          stationId: 'station-1',
          note: 'تسرب صغير',
          photoUrl: 'https://x/photo.jpg',
          audioUrl: 'https://x/note.m4a',
        },
      });
    });
  });

  describe('updateHazardStatus()', () => {
    it('throws NotFoundException for a hazard outside this company', async () => {
      prisma.hazardReport.findFirst.mockResolvedValue(null);
      await expect(service.updateHazardStatus('company-A', 'ghost', HazardStatus.CLOSED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('raiseSos()', () => {
    it('notifies every active COMPANY_ADMIN/TEAM_LEAD via BOTH socket emit and persisted Notification', async () => {
      prisma.sosAlert.create.mockResolvedValue({ id: 'sos-1', raisedBy: { firstName: 'Ali', lastName: 'K' } });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'lead-1' }]);

      await service.raiseSos('company-A', 'worker-1', 'station-1', 24.7, 46.6);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ systemRole: { in: [SystemRole.COMPANY_ADMIN, SystemRole.TEAM_LEAD] } }),
        }),
      );
      expect(chatGateway.server.to).toHaveBeenCalledWith('user:admin-1');
      expect(chatGateway.server.to).toHaveBeenCalledWith('user:lead-1');
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1', link: '/safety/sos/sos-1' }));
    });

    it('a notification failure never breaks the SOS alert itself (life-safety path must not fail silently on a secondary error)', async () => {
      prisma.sosAlert.create.mockResolvedValue({ id: 'sos-1', raisedBy: { firstName: 'Ali', lastName: 'K' } });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      notifications.create.mockRejectedValue(new Error('notification service down'));

      await expect(service.raiseSos('company-A', 'worker-1')).resolves.toEqual(expect.objectContaining({ id: 'sos-1' }));
    });
  });

  describe('resolveSos()', () => {
    it('throws NotFoundException for an alert outside this company', async () => {
      prisma.sosAlert.findFirst.mockResolvedValue(null);
      await expect(service.resolveSos('company-A', 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('sets resolvedAt on success', async () => {
      prisma.sosAlert.findFirst.mockResolvedValue({ id: 'sos-1' });
      prisma.sosAlert.update.mockResolvedValue({});
      await service.resolveSos('company-A', 'sos-1');
      expect(prisma.sosAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ resolvedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('listActiveSos()', () => {
    it('only queries alerts where resolvedAt is null', async () => {
      prisma.sosAlert.findMany.mockResolvedValue([]);
      await service.listActiveSos('company-A');
      expect(prisma.sosAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'company-A', resolvedAt: null } }),
      );
    });
  });
});
