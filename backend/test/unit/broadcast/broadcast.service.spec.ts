import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConversationType, SystemRole } from '@prisma/client';
import { BroadcastService } from '../../../src/modules/broadcast/broadcast.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { MessagesService } from '../../../src/modules/messages/messages.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: any;
  let conversations: any;
  let messages: any;
  let notifications: any;

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      conversation: { findFirst: jest.fn(), create: jest.fn() },
      conversationMember: { findMany: jest.fn(), createMany: jest.fn(), count: jest.fn() },
      station: { findFirst: jest.fn() },
      team: { findFirst: jest.fn() },
    };
    conversations = { create: jest.fn() };
    messages = { sendText: jest.fn() };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: MessagesService, useValue: messages },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(BroadcastService);
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
    messages.sendText.mockResolvedValue({ id: 'msg-1' });
    prisma.conversationMember.count.mockResolvedValue(1);
    // Safe default consumed only when a test hasn't queued its own
    // mockResolvedValueOnce values — the new notifyRecipients() call
    // (added for the Notification Center integration) queries
    // conversationMember.findMany one more time per send(); returning []
    // here keeps every pre-existing test's assertions unaffected.
    prisma.conversationMember.findMany.mockResolvedValue([]);
  });

  it('REJECTS senders who are not Company Admin or Super Admin', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', systemRole: SystemRole.WORKER });
    await expect(service.send('company-A', 'u1', 'hello', 'en')).rejects.toThrow(ForbiddenException);
    expect(messages.sendText).not.toHaveBeenCalled();
  });

  describe('target: ALL (default)', () => {
    it('creates the ANNOUNCEMENT channel when none exists yet', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-new' });

      await service.send('company-A', 'admin-1', 'إجازة رسمية', 'ar', { type: 'ALL' });

      expect(conversations.create).toHaveBeenCalledWith('company-A', 'admin-1', { type: ConversationType.ANNOUNCEMENT });
    });

    it('uses EMERGENCY when urgent=true', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-e' });

      await service.send('company-A', 'admin-1', 'إخلاء', 'ar', { type: 'ALL' }, true);

      expect(conversations.create).toHaveBeenCalledWith('company-A', 'admin-1', { type: ConversationType.EMERGENCY });
    });

    it('syncs newly-hired active users into an existing channel', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-existing' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'u1' }]);

      await service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'ALL' });

      expect(prisma.conversationMember.createMany).toHaveBeenCalledWith({
        data: [{ conversationId: 'conv-existing', userId: 'u2' }],
        skipDuplicates: true,
      });
    });
  });

  describe('target: ROLE', () => {
    it('throws NotFoundException when no active users have that role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'ROLE', role: SystemRole.WORKER })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a GROUP channel scoped to that role, and reuses it on a second send', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
      prisma.conversation.findFirst.mockResolvedValueOnce(null); // first send: no existing channel
      prisma.conversation.create.mockResolvedValue({ id: 'conv-role-worker' });

      await service.send('company-A', 'admin-1', 'شفت جديد', 'ar', { type: 'ROLE', role: SystemRole.WORKER });

      expect(prisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: ConversationType.GROUP, title: '__role_broadcast__WORKER' }),
        }),
      );

      // second send — channel now exists, must be REUSED not recreated
      prisma.conversation.findFirst.mockResolvedValueOnce({ id: 'conv-role-worker' });
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'w1' }, { userId: 'w2' }]);
      prisma.conversation.create.mockClear();

      await service.send('company-A', 'admin-1', 'تذكير ثانٍ', 'ar', { type: 'ROLE', role: SystemRole.WORKER });
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('target: STATION', () => {
    it('throws NotFoundException for a station outside this company', async () => {
      prisma.station.findFirst.mockResolvedValue(null);
      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'STATION', stationId: 's1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reuses the existing STATION Smart Channel rather than creating a duplicate', async () => {
      prisma.station.findFirst.mockResolvedValue({ id: 's1', name: 'Riyadh Station' });
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-station-1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'staff-1' }]);
      prisma.conversationMember.findMany.mockResolvedValue([]);

      const conversationId = await (service as any).resolveStationChannel('company-A', 'admin-1', 's1');

      expect(conversations.create).not.toHaveBeenCalled();
      expect(conversationId).toBe('conv-station-1');
    });
  });

  describe('target: TEAM', () => {
    it('throws NotFoundException for a team outside this company', async () => {
      prisma.team.findFirst.mockResolvedValue(null);
      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'TEAM', teamId: 't1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('target: USER', () => {
    it('rejects broadcasting to yourself', async () => {
      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'USER', userId: 'admin-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a recipient who does not belong to this company', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN }).mockResolvedValueOnce(null);
      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'USER', userId: 'ghost' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('reuses an existing DIRECT conversation instead of creating a new one', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN })
        .mockResolvedValueOnce({ id: 'worker-1', isActive: true });
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-direct-existing' });

      await service.send('company-A', 'admin-1', 'تحية شخصية', 'ar', { type: 'USER', userId: 'worker-1' });

      expect(conversations.create).not.toHaveBeenCalled();
      expect(messages.sendText).toHaveBeenCalledWith('company-A', 'conv-direct-existing', 'admin-1', {
        text: 'تحية شخصية',
        originalLang: 'ar',
      });
    });

    it('creates a new DIRECT conversation when none exists yet', async () => {
      prisma.user.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN })
        .mockResolvedValueOnce({ id: 'worker-1', isActive: true });
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-direct-new' });

      await service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'USER', userId: 'worker-1' });

      expect(conversations.create).toHaveBeenCalledWith('company-A', 'admin-1', { type: ConversationType.DIRECT, memberIds: ['worker-1'] });
    });
  });

  describe('notification fan-out', () => {
    it('creates a BROADCAST_RECEIVED notification for every OTHER recipient (not the sender)', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-new' });
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'worker-1' }, { userId: 'worker-2' }]);

      await service.send('company-A', 'admin-1', 'إجازة رسمية غدًا', 'ar', { type: 'ALL' });

      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'worker-1', type: 'BROADCAST_RECEIVED', link: '/messaging/conv-new' }),
      );
    });

    it('uses the SYSTEM type with an urgent title for emergency broadcasts', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-e' });
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'worker-1' }]);

      await service.send('company-A', 'admin-1', 'إخلاء فوري', 'ar', { type: 'ALL' }, true);

      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'SYSTEM', title: '🚨 إشعار طارئ' }));
    });

    it('a notification-creation failure never breaks the broadcast send itself', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      conversations.create.mockResolvedValue({ id: 'conv-new' });
      prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'worker-1' }]);
      notifications.create.mockRejectedValue(new Error('notification service down'));

      await expect(service.send('company-A', 'admin-1', 'hi', 'ar', { type: 'ALL' })).resolves.toBeDefined();
    });
  });
});
