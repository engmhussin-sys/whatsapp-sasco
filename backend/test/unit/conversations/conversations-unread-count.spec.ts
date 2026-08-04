import { Test } from '@nestjs/testing';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ChatPolicyService } from '../../../src/modules/chat-policy/chat-policy.service';

/**
 * BUG FIX (confirmed real gap — reported directly): unreadCount didn't
 * exist anywhere in the stack. A person could receive a notification
 * with the sender's name, open the app, and have no way to tell WHICH
 * conversation in the list the new message was in, since every
 * conversation rendered identically whether read or not.
 */
describe('ConversationsService — unreadCount', () => {
  let service: ConversationsService;
  let prisma: any;

  const companyId = 'company-A';
  const userId = 'user-1';

  beforeEach(async () => {
    prisma = {
      conversation: { findMany: jest.fn() },
      messageReceipt: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChatPolicyService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ConversationsService);
  });

  it('attaches a per-conversation unread count derived from this user\'s own unread receipts', async () => {
    prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }, { id: 'conv-2' }]);
    prisma.messageReceipt.findMany.mockResolvedValue([
      { message: { conversationId: 'conv-1' } },
      { message: { conversationId: 'conv-1' } },
      { message: { conversationId: 'conv-2' } },
    ]);

    const result = await service.findAllForUser(companyId, userId);

    expect(result).toEqual([
      { id: 'conv-1', unreadCount: 2 },
      { id: 'conv-2', unreadCount: 1 },
    ]);
  });

  it('reports 0 (not undefined/missing) for a conversation with no unread receipts', async () => {
    prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }]);
    prisma.messageReceipt.findMany.mockResolvedValue([]);

    const result = await service.findAllForUser(companyId, userId);

    expect(result[0].unreadCount).toBe(0);
  });

  it('only counts THIS user\'s own receipts — filters by userId, not just conversation membership', async () => {
    prisma.conversation.findMany.mockResolvedValue([{ id: 'conv-1' }]);
    prisma.messageReceipt.findMany.mockResolvedValue([]);

    await service.findAllForUser(companyId, userId);

    expect(prisma.messageReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId, status: { not: 'READ' } }) }),
    );
  });
});
