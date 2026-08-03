import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConversationType, SystemRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';

/**
 * BROADCAST — thin orchestration over two things that already exist:
 * the ANNOUNCEMENT conversation type (auto-derives membership = every
 * active company user, admin-only posting — built in Sprint 3) and the
 * Translation Engine's fan-out (activated in MessagesService.sendText —
 * translates to every OTHER member's preferredLanguage automatically).
 * This service adds exactly the missing piece: a single call that
 * finds-or-creates the company's announcement channel, keeps its
 * membership in sync with newly-added employees, and sends through it
 * with an explicit sender-chosen source language (rather than defaulting
 * to the admin's own preferred language, which may not be what they
 * typed the announcement in).
 */
@Injectable()
export class BroadcastService {
  constructor(
    private prisma: PrismaService,
    private conversations: ConversationsService,
    private messages: MessagesService,
  ) {}

  async send(companyId: string, senderId: string, text: string, sourceLanguage: string, urgent = false) {
    const sender = await this.prisma.user.findFirst({ where: { id: senderId, companyId } });
    if (!sender || (sender.systemRole !== SystemRole.COMPANY_ADMIN && sender.systemRole !== SystemRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Only Company Admins may send broadcasts');
    }

    const type = urgent ? ConversationType.EMERGENCY : ConversationType.ANNOUNCEMENT;

    let conversation = await this.prisma.conversation.findFirst({
      where: { companyId, type },
      orderBy: { createdAt: 'asc' },
    });

    if (!conversation) {
      conversation = await this.conversations.create(companyId, senderId, { type });
    } else {
      // Keep membership in sync — employees hired after the channel was
      // first created must still receive future broadcasts.
      const activeUsers = await this.prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      const currentMembers = await this.prisma.conversationMember.findMany({
        where: { conversationId: conversation.id },
        select: { userId: true },
      });
      const currentMemberIds = new Set(currentMembers.map((m: { userId: string }) => m.userId));
      const missing = activeUsers.filter((u: { id: string }) => !currentMemberIds.has(u.id));
      if (missing.length) {
        await this.prisma.conversationMember.createMany({
          data: missing.map((u: { id: string }) => ({ conversationId: conversation!.id, userId: u.id })),
          skipDuplicates: true,
        });
      }
    }

    const message = await this.messages.sendText(companyId, conversation.id, senderId, { text, originalLang: sourceLanguage });

    return { conversationId: conversation.id, message, recipientCount: await this.recipientCount(conversation.id) };
  }

  private async recipientCount(conversationId: string): Promise<number> {
    return this.prisma.conversationMember.count({ where: { conversationId } });
  }
}
