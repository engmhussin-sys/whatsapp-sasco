import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateConversationDto } from './dto/conversations.dto';

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, creatorId: string, dto: CreateConversationDto) {
    // Every member id must belong to the SAME tenant — the classic
    // cross-tenant-linking mistake this guards against is a Company
    // Admin (maliciously or accidentally) starting a conversation that
    // includes a user id copy-pasted from a different company's export.
    const memberIds = Array.from(new Set([...dto.memberIds, creatorId]));
    const members = await this.prisma.user.findMany({
      where: { id: { in: memberIds }, companyId },
      select: { id: true },
    });
    if (members.length !== memberIds.length) {
      throw new BadRequestException('One or more members do not belong to this company');
    }

    if (dto.type === ConversationType.DIRECT && memberIds.length !== 2) {
      throw new BadRequestException('DIRECT conversations must have exactly 2 members');
    }

    if (dto.type === ConversationType.TEAM) {
      if (!dto.teamId) throw new BadRequestException('teamId is required for TEAM conversations');
      const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, companyId } });
      if (!team) throw new NotFoundException('Team not found');
    }

    return this.prisma.conversation.create({
      data: {
        companyId,
        type: dto.type,
        title: dto.title,
        teamId: dto.type === ConversationType.TEAM ? dto.teamId : undefined,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } } },
    });
  }

  async findAllForUser(companyId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: { companyId, members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(companyId: string, userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Membership check: even within the same tenant, only participants
    // may view a conversation (a Worker in Team A shouldn't read Team B's chat).
    const isMember = conversation.members.some((m: { userId: string }) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');

    return conversation;
  }

  /** Used internally by MessagesService / ChatGateway to validate membership before allowing a send. */
  async assertMembership(companyId: string, conversationId: string, userId: string) {
    const membership = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId, conversation: { companyId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this conversation');
    return membership;
  }
}
