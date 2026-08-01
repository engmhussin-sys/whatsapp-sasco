import { AuditAction } from '@prisma/client';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async create(companyId: string, actorId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: { companyId, name: dto.name, description: dto.description },
    });
    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Team',
      entityId: team.id,
    });
    return team;
  }

  findAll(companyId: string) {
    return this.prisma.team.findMany({
      where: { companyId },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, companyId },
      include: {
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(companyId: string, id: string, dto: UpdateTeamDto) {
    await this.findOne(companyId, id);
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  async remove(companyId: string, id: string, actorId: string) {
    await this.findOne(companyId, id);
    await this.prisma.team.delete({ where: { id } });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.DELETE, entityType: 'Team', entityId: id });
  }

  async addMember(companyId: string, teamId: string, userId: string, isLead: boolean, actorId: string) {
    // Verify both team and user belong to the SAME tenant before linking — prevents
    // a Company Admin from ever attaching a foreign-tenant user to their team.
    const [team, user] = await Promise.all([
      this.prisma.team.findFirst({ where: { id: teamId, companyId } }),
      this.prisma.user.findFirst({ where: { id: userId, companyId } }),
    ]);
    if (!team) throw new NotFoundException('Team not found');
    if (!user) throw new NotFoundException('User not found in this company');

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (existing) throw new ConflictException('User is already a member of this team');

    const member = await this.prisma.teamMember.create({ data: { teamId, userId, isLead } });
    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Team',
      entityId: teamId,
      metadata: { addedMember: userId },
    });
    return member;
  }

  async removeMember(companyId: string, teamId: string, userId: string, actorId: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Team',
      entityId: teamId,
      metadata: { removedMember: userId },
    });
  }
}
