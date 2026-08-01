import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { TaskEngineService } from '../task-engine/task-engine.service';
import { CreateInspectionDto } from './dto/inspections.dto';

@Injectable()
export class InspectionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private taskEngine: TaskEngineService,
  ) {}

  async create(companyId: string, actorId: string, dto: CreateInspectionDto) {
    const station = await this.prisma.station.findFirst({ where: { id: dto.stationId, companyId } });
    if (!station) throw new NotFoundException('Station not found');

    const task = await this.taskEngine.createTask(companyId, actorId, {
      templateId: dto.taskTemplateId,
      title: dto.title ?? `Inspection — ${station.name}`,
      assigneeIds: dto.assigneeId ? [dto.assigneeId] : undefined,
    });

    const inspection = await this.prisma.inspection.create({
      data: { companyId, stationId: dto.stationId, taskId: task.id },
      include: { task: { include: { template: true, assignments: true } }, station: true },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Inspection',
      entityId: inspection.id,
      metadata: { stationId: dto.stationId },
    });

    return inspection;
  }

  findAllForStation(companyId: string, stationId: string) {
    return this.prisma.inspection.findMany({
      where: { companyId, stationId },
      include: { task: { include: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id, companyId },
      include: { task: { include: { template: true, responses: { include: { attachments: true } } } }, station: true },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }
}
