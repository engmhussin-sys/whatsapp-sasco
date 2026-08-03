import { Test } from '@nestjs/testing';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ChatPolicyService } from '../../../src/modules/chat-policy/chat-policy.service';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

describe('ConversationsService — Group 4 mute/archive', () => {
  let service: ConversationsService;
  let prisma: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      conversationMember: { findFirst: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatPolicyService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ConversationsService);
  });

  describe('setMuted()', () => {
    it('checks membership before updating', async () => {
      prisma.conversationMember.findFirst.mockResolvedValue(null);
      await expect(service.setMuted(companyId, conversationId, userId, true)).rejects.toThrow(
        'You are not a member of this conversation',
      );
      expect(prisma.conversationMember.update).not.toHaveBeenCalled();
    });

    it('updates ONLY this member row — muting never affects other members', async () => {
      prisma.conversationMember.findFirst.mockResolvedValue({ conversationId, userId });
      prisma.conversationMember.update.mockResolvedValue({});

      await service.setMuted(companyId, conversationId, userId, true);

      expect(prisma.conversationMember.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId, userId } },
        data: { isMuted: true },
      });
    });
  });

  describe('setArchived()', () => {
    it('checks membership before updating', async () => {
      prisma.conversationMember.findFirst.mockResolvedValue(null);
      await expect(service.setArchived(companyId, conversationId, userId, true)).rejects.toThrow(
        'You are not a member of this conversation',
      );
    });

    it('updates ONLY this member row — archiving never affects other members', async () => {
      prisma.conversationMember.findFirst.mockResolvedValue({ conversationId, userId });
      prisma.conversationMember.update.mockResolvedValue({});

      await service.setArchived(companyId, conversationId, userId, false);

      expect(prisma.conversationMember.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId, userId } },
        data: { isArchived: false },
      });
    });
  });
});
