import { Test } from '@nestjs/testing';
import { SystemRole } from '@prisma/client';
import { ConversationsService } from '../../../src/modules/conversations/conversations.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { ChatPolicyService } from '../../../src/modules/chat-policy/chat-policy.service';

/**
 * BUG FIX (confirmed via a real user report + screenshot): a worker was
 * blocked from replying in what was clearly a normal DIRECT conversation
 * with the exact "This channel is read-only for your role" error — the
 * same error a broadcast/announcement channel is SUPPOSED to show non-
 * admins. assertCanPost used to trust the conversation's stored
 * `postingRestricted` boolean alone; it now also requires the
 * conversation's TYPE to actually be ANNOUNCEMENT/EMERGENCY, so a non-
 * broadcast conversation can never be blocked by this check no matter
 * what that separate flag says. This is the test coverage that should
 * have existed from the start and would have caught this class of bug
 * immediately.
 */
describe('ConversationsService — assertCanPost', () => {
  let service: ConversationsService;
  let prisma: any;

  const companyId = 'company-A';
  const conversationId = 'conv-1';
  const userId = 'worker-1';

  beforeEach(async () => {
    prisma = {
      conversation: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
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

  it('throws NotFoundException for a missing or cross-tenant conversation', async () => {
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(service.assertCanPost(companyId, conversationId, userId)).rejects.toThrow('Conversation not found');
  });

  it('ALLOWS a worker to post in a DIRECT conversation even if postingRestricted is somehow (incorrectly) true — the exact bug reported', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'DIRECT', postingRestricted: true });

    await expect(service.assertCanPost(companyId, conversationId, userId)).resolves.toBeUndefined();
    // The user lookup should never even happen — the type check short-circuits first.
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it.each(['GROUP', 'TEAM', 'TASK', 'STATION', 'SHIFT'])(
    'ALLOWS a worker to post in a %s conversation even if postingRestricted is somehow true',
    async (type) => {
      prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type, postingRestricted: true });
      await expect(service.assertCanPost(companyId, conversationId, userId)).resolves.toBeUndefined();
    },
  );

  it('ALLOWS posting in an ANNOUNCEMENT channel when postingRestricted is false', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'ANNOUNCEMENT', postingRestricted: false });
    await expect(service.assertCanPost(companyId, conversationId, userId)).resolves.toBeUndefined();
  });

  it('BLOCKS a worker from posting in an actual ANNOUNCEMENT channel with postingRestricted=true', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'ANNOUNCEMENT', postingRestricted: true });
    prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.WORKER });

    await expect(service.assertCanPost(companyId, conversationId, userId)).rejects.toThrow(
      'This channel is read-only for your role — only Company Admins may post here',
    );
  });

  it('BLOCKS a worker from posting in an actual EMERGENCY channel with postingRestricted=true', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'EMERGENCY', postingRestricted: true });
    prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.TEAM_LEAD });

    await expect(service.assertCanPost(companyId, conversationId, userId)).rejects.toThrow(
      'This channel is read-only for your role — only Company Admins may post here',
    );
  });

  it('ALLOWS a COMPANY_ADMIN to post in a restricted ANNOUNCEMENT channel', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'ANNOUNCEMENT', postingRestricted: true });
    prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.COMPANY_ADMIN });

    await expect(service.assertCanPost(companyId, conversationId, userId)).resolves.toBeUndefined();
  });

  it('ALLOWS a SUPER_ADMIN to post in a restricted EMERGENCY channel', async () => {
    prisma.conversation.findFirst.mockResolvedValue({ id: conversationId, type: 'EMERGENCY', postingRestricted: true });
    prisma.user.findFirst.mockResolvedValue({ id: userId, systemRole: SystemRole.SUPER_ADMIN });

    await expect(service.assertCanPost(companyId, conversationId, userId)).resolves.toBeUndefined();
  });
});
