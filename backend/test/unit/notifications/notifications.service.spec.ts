import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ChatGateway } from '../../../src/modules/websocket/chat.gateway';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let chatGateway: any;

  beforeEach(async () => {
    prisma = {
      notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };
    chatGateway = { server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } };

    const moduleRef = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }, { provide: ChatGateway, useValue: chatGateway }],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe('create()', () => {
    it('persists the notification and pushes it to the user\'s real-time room', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1', userId: 'u1', title: 'مهمة جديدة' });

      const result = await service.create({ userId: 'u1', type: NotificationType.TASK_ASSIGNED, title: 'مهمة جديدة' });

      expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1' }) }));
      expect(chatGateway.server.to).toHaveBeenCalledWith('user:u1');
      expect(result.id).toBe('n1');
    });

    it('still returns the persisted notification even when real-time push fails', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'n1', userId: 'u1' });
      chatGateway.server.to.mockImplementation(() => {
        throw new Error('socket server unavailable');
      });

      const result = await service.create({ userId: 'u1', type: NotificationType.SYSTEM, title: 'x' });
      expect(result.id).toBe('n1');
    });

    it('works with no ChatGateway injected at all (REST-only mode)', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      const restOnlyService = moduleRef.get(NotificationsService);
      prisma.notification.create.mockResolvedValue({ id: 'n2' });

      await expect(restOnlyService.create({ userId: 'u1', type: NotificationType.SYSTEM, title: 'x' })).resolves.toEqual({ id: 'n2' });
    });
  });

  describe('listForUser()', () => {
    it('filters to unread only when requested', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listForUser('u1', { unreadOnly: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', isRead: false } }));
    });

    it('defaults to page size 30 when not specified', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count.mockResolvedValue(0);

      await service.listForUser('u1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 30, skip: 0 }));
    });
  });

  describe('markAsRead()', () => {
    it('throws when the notification does not belong to this user (prevents cross-user tampering)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await expect(service.markAsRead('u1', 'n-not-mine')).rejects.toThrow(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks a valid notification as read with a timestamp', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1', userId: 'u1' });
      prisma.notification.update.mockResolvedValue({ id: 'n1', isRead: true });

      await service.markAsRead('u1', 'n1');

      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'n1' }, data: expect.objectContaining({ isRead: true, readAt: expect.any(Date) }) }),
      );
    });
  });

  describe('markAllAsRead()', () => {
    it('only updates this user\'s unread notifications', async () => {
      await service.markAllAsRead('u1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1', isRead: false } }),
      );
    });
  });

  describe('unreadCount()', () => {
    it('counts only unread notifications for this user', async () => {
      prisma.notification.count.mockResolvedValue(4);
      const count = await service.unreadCount('u1');
      expect(count).toBe(4);
      expect(prisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', isRead: false } });
    });
  });
});
