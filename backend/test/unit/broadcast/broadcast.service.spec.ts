import { ForbiddenException } from '@nestjs/common';
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
      conversation: { findFirst: jest.fn() },
      conversationMember: { findMany: jest.fn(), createMany: jest.fn(), count: jest.fn() },
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
  });

  it('REJECTS senders who are not Company Admin or Super Admin', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', systemRole: SystemRole.WORKER });
    await expect(service.send('company-A', 'u1', 'hello', 'en')).rejects.toThrow(ForbiddenException);
    expect(messages.sendText).not.toHaveBeenCalled();
  });

  it('REJECTS a sender that does not belong to this company at all', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.send('company-A', 'u1', 'hello', 'en')).rejects.toThrow(ForbiddenException);
  });

  it('creates the ANNOUNCEMENT channel when none exists yet, then sends through it', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
    prisma.conversation.findFirst.mockResolvedValue(null);
    conversations.create.mockResolvedValue({ id: 'conv-new' });
    messages.sendText.mockResolvedValue({ id: 'msg-1' });
    prisma.conversationMember.count.mockResolvedValue(42);

    const result = await service.send('company-A', 'admin-1', 'إجازة رسمية غدًا', 'ar');

    expect(conversations.create).toHaveBeenCalledWith('company-A', 'admin-1', { type: ConversationType.ANNOUNCEMENT });
    expect(messages.sendText).toHaveBeenCalledWith('company-A', 'conv-new', 'admin-1', { text: 'إجازة رسمية غدًا', originalLang: 'ar' });
    expect(result.recipientCount).toBe(42);
  });

  it('uses EMERGENCY channel type when urgent=true', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
    prisma.conversation.findFirst.mockResolvedValue(null);
    conversations.create.mockResolvedValue({ id: 'conv-emergency' });
    messages.sendText.mockResolvedValue({});
    prisma.conversationMember.count.mockResolvedValue(10);

    await service.send('company-A', 'admin-1', 'إخلاء فوري', 'ar', true);

    expect(conversations.create).toHaveBeenCalledWith('company-A', 'admin-1', { type: ConversationType.EMERGENCY });
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'company-A', type: ConversationType.EMERGENCY } }),
    );
  });

  it('REUSES an existing announcement channel and adds newly-hired employees who are missing from it', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-existing' });
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]); // u3 is new/missing
    messages.sendText.mockResolvedValue({});
    prisma.conversationMember.count.mockResolvedValue(3);

    await service.send('company-A', 'admin-1', 'تحديث', 'en');

    expect(conversations.create).not.toHaveBeenCalled();
    expect(prisma.conversationMember.createMany).toHaveBeenCalledWith({
      data: [{ conversationId: 'conv-existing', userId: 'u3' }],
      skipDuplicates: true,
    });
  });

  it('does NOT touch membership when everyone active is already a member', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.SUPER_ADMIN });
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-existing' });
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    prisma.conversationMember.findMany.mockResolvedValue([{ userId: 'u1' }]);
    messages.sendText.mockResolvedValue({});
    prisma.conversationMember.count.mockResolvedValue(1);

    await service.send('company-A', 'admin-1', 'hi', 'en');

    expect(prisma.conversationMember.createMany).not.toHaveBeenCalled();
  });
});
