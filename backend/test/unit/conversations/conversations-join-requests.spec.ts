import { Test } from '@nestjs/testing';
import { SystemRole } from '@prisma/client';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ChatPolicyService } from '../../../src/modules/chat-policy/chat-policy.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('ConversationsService — Join Requests', () => {
  let service: ConversationsService;
  let prisma: any;
  let notifications: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'user-1';
  const adminId = 'admin-1';

  beforeEach(async () => {
    prisma = {
      conversation: { findMany: jest.fn(), findFirst: jest.fn() },
      conversationMember: { findUnique: jest.fn(), create: jest.fn() },
      conversationJoinRequest: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatPolicyService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(ConversationsService);
  });

  describe('listJoinableGroups()', () => {
    it('excludes groups the user is already in and surfaces their own pending-request status', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'g1', title: 'Group One', members: [{ userId: 'other' }], joinRequests: [{ status: 'PENDING' }] },
        { id: 'g2', title: 'Group Two', members: [], joinRequests: [] },
      ]);

      const result = await service.listJoinableGroups(companyId, userId);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: 'GROUP', members: { none: { userId } } }) }),
      );
      expect(result).toEqual([
        { id: 'g1', title: 'Group One', memberCount: 1, myRequestStatus: 'PENDING' },
        { id: 'g2', title: 'Group Two', memberCount: 0, myRequestStatus: null },
      ]);
    });
  });

  describe('requestToJoin()', () => {
    it('throws NotFoundException for a non-group or cross-tenant conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      await expect(service.requestToJoin(companyId, conversationId, userId)).rejects.toThrow('Group conversation not found');
    });

    it('rejects if the requester is already a member', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, title: 'G' });
      prisma.conversationMember.findUnique.mockResolvedValue({ conversationId, userId });
      await expect(service.requestToJoin(companyId, conversationId, userId)).rejects.toThrow('You are already a member of this group');
    });

    it('rejects a duplicate PENDING request', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, title: 'G' });
      prisma.conversationMember.findUnique.mockResolvedValue(null);
      prisma.conversationJoinRequest.findFirst.mockResolvedValue({ id: 'existing', status: 'PENDING' });
      await expect(service.requestToJoin(companyId, conversationId, userId)).rejects.toThrow('You already have a pending request for this group');
    });

    it('creates the request and notifies every admin/lead in the company (best-effort)', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, title: 'Fuel Team' });
      prisma.conversationMember.findUnique.mockResolvedValue(null);
      prisma.conversationJoinRequest.findFirst.mockResolvedValue(null);
      prisma.conversationJoinRequest.create.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Sara', lastName: 'Worker' });

      const result = await service.requestToJoin(companyId, conversationId, userId);

      expect(prisma.conversationJoinRequest.create).toHaveBeenCalledWith({ data: { conversationId, requesterId: userId } });
      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: 'req-1', status: 'PENDING' });
    });

    it('a failed notification does NOT roll back or fail the already-created request', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, title: 'G' });
      prisma.conversationMember.findUnique.mockResolvedValue(null);
      prisma.conversationJoinRequest.findFirst.mockResolvedValue(null);
      prisma.conversationJoinRequest.create.mockResolvedValue({ id: 'req-1', status: 'PENDING' });
      prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      prisma.user.findUnique.mockResolvedValue({ firstName: 'S', lastName: 'W' });
      notifications.create.mockRejectedValue(new Error('notification service down'));

      await expect(service.requestToJoin(companyId, conversationId, userId)).resolves.toEqual({ id: 'req-1', status: 'PENDING' });
    });
  });

  describe('listPendingJoinRequests()', () => {
    it('rejects a non-admin caller', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.WORKER });
      await expect(service.listPendingJoinRequests(companyId, conversationId, userId)).rejects.toThrow(
        'Only a Company Admin, Team Lead, or Super Admin can manage join requests',
      );
    });

    it('returns PENDING requests with requester details for an admin caller', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: adminId, systemRole: SystemRole.COMPANY_ADMIN });
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, title: 'G' });
      prisma.conversationJoinRequest.findMany.mockResolvedValue([{ id: 'req-1', status: 'PENDING' }]);

      const result = await service.listPendingJoinRequests(companyId, conversationId, adminId);

      expect(prisma.conversationJoinRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conversationId, status: 'PENDING' } }),
      );
      expect(result).toEqual([{ id: 'req-1', status: 'PENDING' }]);
    });
  });

  describe('decideJoinRequest()', () => {
    it('rejects a non-admin decider', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.WORKER });
      await expect(service.decideJoinRequest(companyId, 'req-1', userId, true)).rejects.toThrow(
        'Only a Company Admin, Team Lead, or Super Admin can manage join requests',
      );
    });

    it('throws NotFoundException for a cross-tenant or missing request', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: adminId, systemRole: SystemRole.COMPANY_ADMIN });
      prisma.conversationJoinRequest.findFirst.mockResolvedValue(null);
      await expect(service.decideJoinRequest(companyId, 'req-1', adminId, true)).rejects.toThrow('Join request not found');
    });

    it('rejects deciding an already-decided request', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: adminId, systemRole: SystemRole.COMPANY_ADMIN });
      prisma.conversationJoinRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'APPROVED',
        conversationId,
        requesterId: userId,
        conversation: { title: 'G' },
      });
      await expect(service.decideJoinRequest(companyId, 'req-1', adminId, true)).rejects.toThrow('This request has already been decided');
    });

    it('on APPROVE: adds the member and marks the request APPROVED atomically', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: adminId, systemRole: SystemRole.COMPANY_ADMIN });
      prisma.conversationJoinRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        conversationId,
        requesterId: userId,
        conversation: { title: 'Fuel Team' },
      });

      const result = await service.decideJoinRequest(companyId, 'req-1', adminId, true);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.conversationMember.create).toHaveBeenCalledWith({ data: { conversationId, userId } });
      expect(prisma.conversationJoinRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'APPROVED', decidedById: adminId }) }),
      );
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId, title: 'تمت الموافقة على طلب الانضمام' }));
      expect(result).toEqual({ requestId: 'req-1', approved: true });
    });

    it('on REJECT: marks the request REJECTED WITHOUT adding a member', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: adminId, systemRole: SystemRole.TEAM_LEAD });
      prisma.conversationJoinRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        conversationId,
        requesterId: userId,
        conversation: { title: 'G' },
      });

      const result = await service.decideJoinRequest(companyId, 'req-1', adminId, false);

      expect(prisma.conversationMember.create).not.toHaveBeenCalled();
      expect(prisma.conversationJoinRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'req-1' }, data: expect.objectContaining({ status: 'REJECTED' }) }),
      );
      expect(result).toEqual({ requestId: 'req-1', approved: false });
    });
  });
});
