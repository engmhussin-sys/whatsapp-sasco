import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType, SystemRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';

export type BroadcastTarget =
  | { type: 'ALL' }
  | { type: 'ROLE'; role: SystemRole }
  | { type: 'STATION'; stationId: string }
  | { type: 'TEAM'; teamId: string }
  | { type: 'USER'; userId: string };

// Stable marker stored in Conversation.title so a role-broadcast GROUP
// channel can be found-and-reused on the next send to the same role,
// rather than spawning a fresh (duplicate) group every time. There's no
// dedicated schema field for this because it's the ONLY target type
// without an existing Smart Channel concept to anchor to (unlike
// TEAM/STATION, which already have contextTeamId/contextStationId).
function roleChannelTitle(role: SystemRole): string {
  return `__role_broadcast__${role}`;
}

/**
 * BROADCAST — routes a single admin-authored message to one of five
 * audiences, reusing the existing Smart Channels wherever one already
 * exists for that audience shape (TEAM, STATION), and finding-or-
 * creating a dedicated channel otherwise (ALL/EMERGENCY, ROLE, USER).
 * Every path ends the same way: MessagesService.sendText(), which is
 * where the Translation Engine fan-out (translates to each recipient's
 * preferredLanguage) already lives — targeting logic here never touches
 * translation at all, by design.
 */
@Injectable()
export class BroadcastService {
  constructor(
    private prisma: PrismaService,
    private conversations: ConversationsService,
    private messages: MessagesService,
  ) {}

  async send(companyId: string, senderId: string, text: string, sourceLanguage: string, target: BroadcastTarget = { type: 'ALL' }, urgent = false) {
    const sender = await this.prisma.user.findFirst({ where: { id: senderId, companyId } });
    if (!sender || (sender.systemRole !== SystemRole.COMPANY_ADMIN && sender.systemRole !== SystemRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Only Company Admins may send broadcasts');
    }

    const conversationId = await this.resolveConversation(companyId, senderId, target, urgent);
    const message = await this.messages.sendText(companyId, conversationId, senderId, { text, originalLang: sourceLanguage });

    return { conversationId, message, recipientCount: await this.recipientCount(conversationId) };
  }

  private async resolveConversation(companyId: string, senderId: string, target: BroadcastTarget, urgent: boolean): Promise<string> {
    switch (target.type) {
      case 'ALL':
        return this.resolveAllCompanyChannel(companyId, senderId, urgent);
      case 'ROLE':
        return this.resolveRoleChannel(companyId, senderId, target.role);
      case 'STATION':
        return this.resolveStationChannel(companyId, senderId, target.stationId);
      case 'TEAM':
        return this.resolveTeamChannel(companyId, senderId, target.teamId);
      case 'USER':
        return this.resolveDirectChannel(companyId, senderId, target.userId);
      default:
        throw new BadRequestException('Unknown broadcast target type');
    }
  }

  // ---- ALL: existing ANNOUNCEMENT/EMERGENCY logic, unchanged --------------
  private async resolveAllCompanyChannel(companyId: string, senderId: string, urgent: boolean): Promise<string> {
    const type = urgent ? ConversationType.EMERGENCY : ConversationType.ANNOUNCEMENT;
    let conversation = await this.prisma.conversation.findFirst({ where: { companyId, type }, orderBy: { createdAt: 'asc' } });

    if (!conversation) {
      conversation = await this.conversations.create(companyId, senderId, { type });
    } else {
      const activeUsers = await this.prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true } });
      await this.syncMembership(conversation.id, activeUsers.map((u: { id: string }) => u.id));
    }
    return conversation.id;
  }

  // ---- ROLE: e.g. every Worker, or every Team Lead -------------------------
  private async resolveRoleChannel(companyId: string, senderId: string, role: SystemRole): Promise<string> {
    const roleUsers = await this.prisma.user.findMany({ where: { companyId, isActive: true, systemRole: role }, select: { id: true } });
    if (roleUsers.length === 0) throw new NotFoundException(`No active users with role ${role} in this company`);

    const title = roleChannelTitle(role);
    let conversation = await this.prisma.conversation.findFirst({ where: { companyId, type: ConversationType.GROUP, title } });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId,
          type: ConversationType.GROUP,
          title,
          postingRestricted: true,
          members: { create: roleUsers.map((u: { id: string }) => ({ userId: u.id })) },
        },
      });
    } else {
      await this.syncMembership(conversation.id, roleUsers.map((u: { id: string }) => u.id));
    }
    return conversation.id;
  }

  // ---- STATION: reuses the Smart Channel already defined for stations -----
  private async resolveStationChannel(companyId: string, senderId: string, stationId: string): Promise<string> {
    const station = await this.prisma.station.findFirst({ where: { id: stationId, companyId } });
    if (!station) throw new NotFoundException('Station not found');

    let conversation = await this.prisma.conversation.findFirst({ where: { companyId, type: ConversationType.STATION, contextStationId: stationId } });

    if (!conversation) {
      conversation = await this.conversations.create(companyId, senderId, { type: ConversationType.STATION, contextStationId: stationId });
    } else {
      const staff = await this.prisma.user.findMany({ where: { companyId, primaryStationId: stationId }, select: { id: true } });
      await this.syncMembership(conversation.id, staff.map((u: { id: string }) => u.id));
    }
    return conversation.id;
  }

  // ---- TEAM: reuses the Smart Channel already defined for teams -----------
  private async resolveTeamChannel(companyId: string, senderId: string, teamId: string): Promise<string> {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, companyId }, include: { members: true } });
    if (!team) throw new NotFoundException('Team not found');

    let conversation = await this.prisma.conversation.findFirst({ where: { companyId, type: ConversationType.TEAM, teamId } });

    if (!conversation) {
      conversation = await this.conversations.create(companyId, senderId, { type: ConversationType.TEAM, teamId });
    } else {
      await this.syncMembership(conversation.id, team.members.map((m: { userId: string }) => m.userId));
    }
    return conversation.id;
  }

  // ---- USER: a single named recipient (DIRECT) -----------------------------
  private async resolveDirectChannel(companyId: string, senderId: string, userId: string): Promise<string> {
    const recipient = await this.prisma.user.findFirst({ where: { id: userId, companyId, isActive: true } });
    if (!recipient) throw new NotFoundException('Recipient not found in this company');
    if (userId === senderId) throw new BadRequestException('Cannot broadcast a message to yourself');

    const existing = await this.prisma.conversation.findFirst({
      where: {
        companyId,
        type: ConversationType.DIRECT,
        AND: [{ members: { some: { userId: senderId } } }, { members: { some: { userId } } }],
      },
    });
    if (existing) return existing.id;

    const created = await this.conversations.create(companyId, senderId, { type: ConversationType.DIRECT, memberIds: [userId] });
    return created.id;
  }

  private async syncMembership(conversationId: string, shouldBeMemberIds: string[]) {
    const current = await this.prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
    const currentIds = new Set(current.map((m: { userId: string }) => m.userId));
    const missing = shouldBeMemberIds.filter((id) => !currentIds.has(id));
    if (missing.length) {
      await this.prisma.conversationMember.createMany({
        data: missing.map((userId) => ({ conversationId, userId })),
        skipDuplicates: true,
      });
    }
  }

  private async recipientCount(conversationId: string): Promise<number> {
    return this.prisma.conversationMember.count({ where: { conversationId } });
  }
}
