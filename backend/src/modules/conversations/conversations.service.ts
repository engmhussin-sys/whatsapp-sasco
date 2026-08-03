import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationType, SystemRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChatPolicyService } from '../chat-policy/chat-policy.service';
import { CreateConversationDto } from './dto/conversations.dto';

const MEMBER_SELECT = { id: true, firstName: true, lastName: true, avatarUrl: true, lastSeenAt: true };

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private chatPolicy: ChatPolicyService,
  ) {}

  async create(companyId: string, creatorId: string, dto: CreateConversationDto) {
    switch (dto.type) {
      case ConversationType.DIRECT:
        return this.createDirect(companyId, creatorId, dto);
      case ConversationType.GROUP:
        return this.createGroup(companyId, creatorId, dto);
      case ConversationType.TEAM:
        return this.createTeamChannel(companyId, creatorId, dto);
      case ConversationType.STATION:
        return this.createStationChannel(companyId, creatorId, dto);
      case ConversationType.SHIFT:
        return this.createShiftChannel(companyId, creatorId, dto);
      case ConversationType.TASK:
        return this.createTaskChannel(companyId, creatorId, dto);
      case ConversationType.ANNOUNCEMENT:
      case ConversationType.EMERGENCY:
        return this.createBroadcastChannel(companyId, creatorId, dto);
    }
  }

  /** Verifies every id belongs to this tenant — the standard cross-tenant-linking guard reused by every channel type below. */
  private async assertSameTenant(companyId: string, userIds: string[]) {
    const found = await this.prisma.user.findMany({ where: { id: { in: userIds }, companyId }, select: { id: true } });
    if (found.length !== new Set(userIds).size) {
      throw new BadRequestException('One or more members do not belong to this company');
    }
  }

  private async createDirect(companyId: string, creatorId: string, dto: CreateConversationDto) {
    const otherIds = (dto.memberIds ?? []).filter((id) => id !== creatorId);
    if (otherIds.length !== 1) {
      throw new BadRequestException('DIRECT conversations must have exactly one other member');
    }
    const memberIds = [creatorId, otherIds[0]];
    await this.assertSameTenant(companyId, memberIds);

    // Chat Policy Engine: role-pair rule AND Visibility Engine, both enforced.
    await this.chatPolicy.assertCanMessage(companyId, creatorId, otherIds[0]);

    return this.persist(companyId, ConversationType.DIRECT, memberIds, { title: dto.title });
  }

  private async createGroup(companyId: string, creatorId: string, dto: CreateConversationDto) {
    const memberIds = Array.from(new Set([...(dto.memberIds ?? []), creatorId]));
    await this.assertSameTenant(companyId, memberIds);

    // Every member the creator adds must individually pass the same Chat
    // Policy check as a DIRECT message would — a Worker can't route
    // around the "Worker->Manager denied" rule just by calling it a group.
    for (const memberId of memberIds) {
      if (memberId !== creatorId) await this.chatPolicy.assertCanMessage(companyId, creatorId, memberId);
    }

    return this.persist(companyId, ConversationType.GROUP, memberIds, { title: dto.title });
  }

  private async createTeamChannel(companyId: string, creatorId: string, dto: CreateConversationDto) {
    if (!dto.teamId) throw new BadRequestException('teamId is required for TEAM conversations');
    const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, companyId }, include: { members: true } });
    if (!team) throw new NotFoundException('Team not found');

    const memberIds = Array.from(new Set([...team.members.map((m: { userId: string }) => m.userId), creatorId]));
    return this.persist(companyId, ConversationType.TEAM, memberIds, { title: dto.title, teamId: dto.teamId });
  }

  private async createStationChannel(companyId: string, creatorId: string, dto: CreateConversationDto) {
    if (!dto.contextStationId) throw new BadRequestException('contextStationId is required for STATION conversations');
    const station = await this.prisma.station.findFirst({ where: { id: dto.contextStationId, companyId } });
    if (!station) throw new NotFoundException('Station not found');

    // Auto-derive membership from staff whose primaryStationId matches,
    // plus any explicitly listed extras (e.g. a visiting supervisor) —
    // this is what "STATION channel" means: everyone assigned there,
    // without the creator having to hand-pick each name.
    const stationStaff = await this.prisma.user.findMany({
      where: { companyId, primaryStationId: dto.contextStationId },
      select: { id: true },
    });
    const memberIds = Array.from(new Set([...stationStaff.map((u: { id: string }) => u.id), ...(dto.memberIds ?? []), creatorId]));

    return this.persist(companyId, ConversationType.STATION, memberIds, {
      title: dto.title ?? station.name,
      contextStationId: dto.contextStationId,
    });
  }

  private async createShiftChannel(companyId: string, creatorId: string, dto: CreateConversationDto) {
    if (!dto.contextShiftLogId) throw new BadRequestException('contextShiftLogId is required for SHIFT conversations');
    const shiftLog = await this.prisma.shiftLog.findFirst({ where: { id: dto.contextShiftLogId, companyId } });
    if (!shiftLog) throw new NotFoundException('Shift log not found');

    const memberIds = Array.from(new Set([...(dto.memberIds ?? []), shiftLog.userId, creatorId]));
    return this.persist(companyId, ConversationType.SHIFT, memberIds, {
      title: dto.title ?? 'Shift Chat',
      contextShiftLogId: dto.contextShiftLogId,
    });
  }

  private async createTaskChannel(companyId: string, creatorId: string, dto: CreateConversationDto) {
    if (!dto.contextTaskId) throw new BadRequestException('contextTaskId is required for TASK conversations');
    const task = await this.prisma.task.findFirst({ where: { id: dto.contextTaskId, companyId }, include: { assignments: true } });
    if (!task) throw new NotFoundException('Task not found');

    const memberIds = Array.from(
      new Set([...task.assignments.map((a: { userId: string }) => a.userId), ...(dto.memberIds ?? []), creatorId]),
    );
    return this.persist(companyId, ConversationType.TASK, memberIds, {
      title: dto.title ?? `Task: ${task.title}`,
      contextTaskId: dto.contextTaskId,
    });
  }

  private async createBroadcastChannel(companyId: string, creatorId: string, dto: CreateConversationDto) {
    // Defense in depth: even though the controller restricts this route
    // to COMPANY_ADMIN/SUPER_ADMIN via @Roles(), re-check here so the
    // service is safe to call directly from anywhere in the future.
    const creator = await this.prisma.user.findFirst({ where: { id: creatorId, companyId } });
    if (!creator || (creator.systemRole !== SystemRole.COMPANY_ADMIN && creator.systemRole !== SystemRole.SUPER_ADMIN)) {
      throw new ForbiddenException('Only Company Admins may create Announcement/Emergency channels');
    }

    const allUsers = await this.prisma.user.findMany({ where: { companyId, isActive: true }, select: { id: true } });
    const memberIds = allUsers.map((u: { id: string }) => u.id);

    return this.persist(companyId, dto.type, memberIds, { title: dto.title, postingRestricted: true });
  }

  private async persist(
    companyId: string,
    type: ConversationType,
    memberIds: string[],
    extra: {
      title?: string;
      teamId?: string;
      contextStationId?: string;
      contextShiftLogId?: string;
      contextTaskId?: string;
      postingRestricted?: boolean;
    },
  ) {
    return this.prisma.conversation.create({
      data: {
        companyId,
        type,
        title: extra.title,
        teamId: extra.teamId,
        contextStationId: extra.contextStationId,
        contextShiftLogId: extra.contextShiftLogId,
        contextTaskId: extra.contextTaskId,
        postingRestricted: extra.postingRestricted ?? false,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { members: { include: { user: { select: MEMBER_SELECT } } } },
    });
  }

  async findAllForUser(companyId: string, userId: string, includeArchived = false) {
    return this.prisma.conversation.findMany({
      where: {
        companyId,
        // Group 4 (WhatsApp parity): archiving is per-member — this
        // ONLY hides it from the user who archived it, matching the
        // model comment on ConversationMember.isArchived exactly.
        members: { some: { userId, ...(includeArchived ? {} : { isArchived: false }) } },
      },
      include: {
        members: { include: { user: { select: MEMBER_SELECT } } },
        messages: { take: 1, orderBy: { createdAt: 'desc' }, include: { translations: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(companyId: string, userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, companyId },
      include: { members: { include: { user: { select: MEMBER_SELECT } } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

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

  /**
   * For ANNOUNCEMENT/EMERGENCY channels (postingRestricted=true), only
   * COMPANY_ADMIN/SUPER_ADMIN may post — everyone else has read-only
   * access. Called by MessagesService before accepting a send.
   */
  async assertCanPost(companyId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, companyId } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.postingRestricted) return;

    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user || (user.systemRole !== SystemRole.COMPANY_ADMIN && user.systemRole !== SystemRole.SUPER_ADMIN)) {
      throw new ForbiddenException('This channel is read-only for your role — only Company Admins may post here');
    }
  }

  /** Group 4 (WhatsApp parity): mute/unmute — per-member, no effect on anyone else. */
  async setMuted(companyId: string, conversationId: string, userId: string, isMuted: boolean) {
    await this.assertMembership(companyId, conversationId, userId);
    return this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted },
    });
  }

  /** Group 4 (WhatsApp parity): archive/unarchive — per-member, no effect on anyone else. */
  async setArchived(companyId: string, conversationId: string, userId: string, isArchived: boolean) {
    await this.assertMembership(companyId, conversationId, userId);
    return this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isArchived },
    });
  }
}
