import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SystemRole, TicketPriority, TicketStatus } from '@prisma/client';
import { SupportTicketsService } from '../../../src/modules/support-tickets/support-tickets.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('SupportTicketsService', () => {
  let service: SupportTicketsService;
  let prisma: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      supportTicket: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      ticketMessage: { create: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [SupportTicketsService, { provide: PrismaService, useValue: prisma }, { provide: NotificationsService, useValue: notifications }],
    }).compile();

    service = moduleRef.get(SupportTicketsService);
  });

  describe('create()', () => {
    it('creates the ticket with an initial message, and notifies every active Super Admin', async () => {
      prisma.supportTicket.create.mockResolvedValue({ id: 't1', subject: 'مشكلة في الفواتير' });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await service.create('company-A', 'user-1', 'مشكلة في الفواتير', 'الفاتورة رقم 5 غير صحيحة', TicketPriority.HIGH);

      expect(prisma.supportTicket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company-A', createdById: 'user-1', priority: TicketPriority.HIGH }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1', link: '/super-admin/support/t1' }));
    });

    it('defaults to MEDIUM priority when none is given', async () => {
      prisma.supportTicket.create.mockResolvedValue({ id: 't1', subject: 'x' });
      prisma.user.findMany.mockResolvedValue([]);

      await service.create('company-A', 'user-1', 'x', 'y');

      expect(prisma.supportTicket.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: TicketPriority.MEDIUM }) }));
    });
  });

  describe('addMessage()', () => {
    it('throws when the ticket does not exist', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);
      await expect(service.addMessage('ghost', 'user-1', 'hi')).rejects.toThrow(NotFoundException);
    });

    it('notifies the TICKET CREATOR when a Super Admin replies', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1', createdById: 'user-1', subject: 'مشكلة' });
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.SUPER_ADMIN });

      await service.addMessage('t1', 'admin-1', 'تم الحل');

      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', title: 'ردّ جديد على تذكرتك' }));
    });

    it('notifies ALL SUPER ADMINS when the ticket creator replies again', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1', createdById: 'user-1', subject: 'مشكلة' });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', systemRole: SystemRole.WORKER });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await service.addMessage('t1', 'user-1', 'إضافة معلومات');

      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1' }));
    });
  });

  describe('updateStatus()', () => {
    it('throws for a non-existent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('ghost', TicketStatus.RESOLVED)).rejects.toThrow(NotFoundException);
    });

    it('sets resolvedAt when moving to RESOLVED', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1', resolvedAt: null });
      prisma.supportTicket.update.mockResolvedValue({});

      await service.updateStatus('t1', TicketStatus.RESOLVED);

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: TicketStatus.RESOLVED, resolvedAt: expect.any(Date) }) }),
      );
    });

    it('does NOT touch resolvedAt for a non-resolving status change', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({ id: 't1', resolvedAt: null });
      prisma.supportTicket.update.mockResolvedValue({});

      await service.updateStatus('t1', TicketStatus.IN_PROGRESS);

      expect(prisma.supportTicket.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolvedAt: null }) }));
    });
  });
});
