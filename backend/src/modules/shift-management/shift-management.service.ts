import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShiftLogStatus, AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TaskEngineService } from '../task-engine/task-engine.service';
import { CreateShiftDto, OpenShiftLogDto, CloseShiftLogDto } from './dto/shift-management.dto';

/**
 * DOMAIN MODULE — built entirely on the generic Task Engine.
 * -----------------------------------------------------------------------
 * Open/close checklists are just Tasks instantiated from whatever
 * TaskTemplate the company configured (e.g. "Open Shift Checklist" with
 * NUMBER/PHOTO/SIGNATURE fields) — ShiftLog only anchors the two Task
 * instances to real timestamps and exposes shift-specific status. This
 * is the intended pattern for every future sector module: never
 * reimplement dynamic-form handling, always delegate to TaskEngineService.
 */
@Injectable()
export class ShiftManagementService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private taskEngine: TaskEngineService,
  ) {}

  async createShift(companyId: string, actorId: string, dto: CreateShiftDto) {
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, companyId } });
      if (!team) throw new NotFoundException('Team not found');
    }
    const shift = await this.prisma.shift.create({
      data: { companyId, name: dto.name, startTime: dto.startTime, endTime: dto.endTime, teamId: dto.teamId },
    });
    await this.auditLogs.record({ companyId, actorId, action: AuditAction.CREATE, entityType: 'Shift', entityId: shift.id });
    return shift;
  }

  findAllShifts(companyId: string) {
    return this.prisma.shift.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
  }

  async openShiftLog(companyId: string, userId: string, dto: OpenShiftLogDto) {
    const shift = await this.prisma.shift.findFirst({ where: { id: dto.shiftId, companyId } });
    if (!shift) throw new NotFoundException('Shift not found');

    // SECURITY: stationId is client-supplied — must be verified to belong
    // to this tenant before being linked to the ShiftLog, otherwise a
    // worker could reference (and thus associate their shift activity
    // with) another company's station.
    if (dto.stationId) {
      const station = await this.prisma.station.findFirst({ where: { id: dto.stationId, companyId } });
      if (!station) throw new NotFoundException('Station not found');
    }

    const alreadyOpen = await this.prisma.shiftLog.findFirst({
      where: { companyId, shiftId: dto.shiftId, userId, status: ShiftLogStatus.OPEN },
    });
    if (alreadyOpen) throw new BadRequestException('You already have an open shift log for this shift');

    let openTaskId: string | undefined;
    if (dto.openTaskTemplateId) {
      const task = await this.taskEngine.createTask(companyId, userId, {
        templateId: dto.openTaskTemplateId,
        title: `Open Shift — ${shift.name}`,
        assigneeIds: [userId],
      });
      openTaskId = task.id;
      if (dto.openAnswers) {
        await this.taskEngine.submitResponse(companyId, task.id, userId, { answers: dto.openAnswers });
      }
    }

    const shiftLog = await this.prisma.shiftLog.create({
      data: {
        companyId,
        shiftId: dto.shiftId,
        userId,
        stationId: dto.stationId,
        openTaskId,
        status: ShiftLogStatus.OPEN,
      },
    });

    await this.auditLogs.record({
      companyId,
      actorId: userId,
      action: AuditAction.CREATE,
      entityType: 'ShiftLog',
      entityId: shiftLog.id,
      metadata: { shiftId: dto.shiftId, stationId: dto.stationId },
    });

    return shiftLog;
  }

  async closeShiftLog(companyId: string, shiftLogId: string, userId: string, dto: CloseShiftLogDto) {
    const shiftLog = await this.prisma.shiftLog.findFirst({ where: { id: shiftLogId, companyId, userId } });
    if (!shiftLog) throw new NotFoundException('Shift log not found');
    if (shiftLog.status !== ShiftLogStatus.OPEN) {
      throw new BadRequestException('This shift log is already closed');
    }

    let closeTaskId: string | undefined;
    if (dto.closeTaskTemplateId) {
      const task = await this.taskEngine.createTask(companyId, userId, {
        templateId: dto.closeTaskTemplateId,
        title: `Close Shift`,
        assigneeIds: [userId],
      });
      closeTaskId = task.id;
      if (dto.closeAnswers) {
        await this.taskEngine.submitResponse(companyId, task.id, userId, { answers: dto.closeAnswers });
      }
    }

    const updated = await this.prisma.shiftLog.update({
      where: { id: shiftLogId },
      data: { status: ShiftLogStatus.CLOSED, endedAt: new Date(), closeTaskId },
    });

    await this.auditLogs.record({
      companyId,
      actorId: userId,
      action: AuditAction.UPDATE,
      entityType: 'ShiftLog',
      entityId: shiftLogId,
      metadata: { closed: true },
    });

    return updated;
  }

  findLogsForUser(companyId: string, userId: string) {
    return this.prisma.shiftLog.findMany({
      where: { companyId, userId },
      include: { shift: true, station: true },
      orderBy: { startedAt: 'desc' },
    });
  }
}
