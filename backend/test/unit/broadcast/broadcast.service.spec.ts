import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConversationType, SystemRole } from '@prisma/client';
import { BroadcastService } from '../../../src/modules/broadcast/broadcast.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { MessagesService } from '../../../src/modules/messages/messages.service';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: any;
  let conversations: any;
  let messages: any;

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConversationsService, useValue: conversations },
        { provide: MessagesService, useValue: messages },
      ],
    }).compile();

    service = moduleRef.get(BroadcastService);
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
    messages.sendText.mockResolvedValue({ id: 'msg-1' });
    prisma.conversationMember.count.mockResolvedValue(1);
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
});
