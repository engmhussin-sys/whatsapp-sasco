import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus, AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ApprovalEngineService } from '../approval-engine/approval-engine.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CreateTaskDto,
  SubmitTaskResponseDto,
  TaskFieldDefinitionDto,
} from './dto/task-engine.dto';

/**
 * GENERIC TASK ENGINE ("Dynamic Forms")
 * -----------------------------------------------------------------------
 * Has no knowledge of shift-opening checklists, fuel-tank inspections,
 * or any other domain concept — it only understands TaskTemplate (an
 * ordered list of typed fields), Task (an assignable instance, optionally
 * built from a template), and TaskResponse (a worker's submitted
 * answers + attachments). Domain modules build on top of this rather
 * than each inventing their own form/assignment/submission logic.
 */
@Injectable()
export class TaskEngineService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private approvalEngine: ApprovalEngineService,
  ) {}

  // ---- Templates ----------------------------------------------------------

  async createTemplate(companyId: string, actorId: string, dto: CreateTaskTemplateDto) {
    this.validateFieldDefinitions(dto.fields);

    if (dto.approvalFlowId) {
      await this.approvalEngine.findFlow(companyId, dto.approvalFlowId); // throws if not found/not this tenant
    }

    const template = await this.prisma.taskTemplate.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        domainTag: dto.domainTag,
        fields: dto.fields as any,
        approvalFlowId: dto.approvalFlowId,
      },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'TaskTemplate',
      entityId: template.id,
      metadata: { name: template.name, fieldCount: dto.fields.length },
    });

    return template;
  }

  private validateFieldDefinitions(fields: TaskFieldDefinitionDto[]) {
    if (fields.length === 0) throw new BadRequestException('A template needs at least one field');
    const ids = fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Field ids must be unique within a template');
    }
  }

  findAllTemplates(companyId: string, domainTag?: string) {
    return this.prisma.taskTemplate.findMany({
      where: { companyId, isActive: true, ...(domainTag ? { domainTag } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTemplate(companyId: string, id: string) {
    const template = await this.prisma.taskTemplate.findFirst({ where: { id, companyId } });
    if (!template) throw new NotFoundException('Task template not found');
    return template;
  }

  async updateTemplate(companyId: string, id: string, dto: UpdateTaskTemplateDto) {
    await this.findTemplate(companyId, id);
    if (dto.fields) this.validateFieldDefinitions(dto.fields);
    return this.prisma.taskTemplate.update({
      where: { id },
      data: { ...dto, fields: dto.fields as any },
    });
  }

  // ---- Tasks ----------------------------------------------------------------

  async createTask(companyId: string, actorId: string, dto: CreateTaskDto) {
    if (dto.templateId) await this.findTemplate(companyId, dto.templateId);

    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, companyId } });
      if (!team) throw new NotFoundException('Team not found');
    }

    if (dto.assigneeIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: dto.assigneeIds }, companyId },
        select: { id: true },
      });
      if (users.length !== dto.assigneeIds.length) {
        throw new BadRequestException('One or more assignees do not belong to this company');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        companyId,
        templateId: dto.templateId,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        teamId: dto.teamId,
        createdById: actorId,
        status: dto.assigneeIds?.length ? TaskStatus.ASSIGNED : TaskStatus.DRAFT,
        assignments: dto.assigneeIds?.length
          ? { create: dto.assigneeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { assignments: true, template: true },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Task',
      entityId: task.id,
      metadata: { title: task.title, templateId: dto.templateId },
    });

    return task;
  }

  findAllTasks(companyId: string, params: { status?: TaskStatus; assignedToUserId?: string; teamId?: string }) {
    return this.prisma.task.findMany({
      where: {
        companyId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.teamId ? { teamId: params.teamId } : {}),
        ...(params.assignedToUserId ? { assignments: { some: { userId: params.assignedToUserId } } } : {}),
      },
      include: { template: true, assignments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTask(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId },
      include: { template: true, assignments: true, responses: { include: { attachments: true, approval: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  /**
   * Worker submits a TaskResponse. If the template has an approvalFlowId,
   * this immediately starts an Approval (entityType="TaskResponse") and
   * links it 1:1 to the response — the Task Engine calls into the
   * Approval Engine but the Approval Engine never calls back, keeping
   * the dependency one-directional.
   */
  async submitResponse(companyId: string, taskId: string, submittedById: string, dto: SubmitTaskResponseDto) {
    const task = await this.findTask(companyId, taskId);

    if (task.template) {
      this.validateAnswersAgainstTemplate(task.template.fields as unknown as TaskFieldDefinitionDto[], dto.answers);
    }

    const response = await this.prisma.taskResponse.create({
      data: { taskId, submittedById, answers: dto.answers as any },
    });

    let newStatus: TaskStatus = TaskStatus.SUBMITTED;

    if (task.template?.approvalFlowId) {
      const approval = await this.approvalEngine.startApproval(companyId, submittedById, {
        flowId: task.template.approvalFlowId,
        entityType: 'TaskResponse',
        entityId: response.id,
      });
      await this.prisma.approval.update({ where: { id: approval.id }, data: { taskResponseId: response.id } });
    } else {
      newStatus = TaskStatus.COMPLETED; // no approval required — submission is final
    }

    await this.prisma.task.update({ where: { id: taskId }, data: { status: newStatus } });

    await this.auditLogs.record({
      companyId,
      actorId: submittedById,
      action: AuditAction.CREATE,
      entityType: 'TaskResponse',
      entityId: response.id,
      metadata: { taskId },
    });

    return this.findTask(companyId, taskId);
  }

  private validateAnswersAgainstTemplate(fields: TaskFieldDefinitionDto[], answers: Record<string, unknown>) {
    for (const field of fields) {
      if (field.required && (answers[field.id] === undefined || answers[field.id] === null || answers[field.id] === '')) {
        throw new BadRequestException(`Field "${field.label}" (${field.id}) is required`);
      }
    }
  }

  async addAttachmentToResponse(
    companyId: string,
    responseId: string,
    fieldId: string,
    kind: any,
    stored: { url: string },
    gps?: { lat: number; lng: number },
  ) {
    const response = await this.prisma.taskResponse.findFirst({
      where: { id: responseId, task: { companyId } },
    });
    if (!response) throw new NotFoundException('Task response not found');

    return this.prisma.taskAttachment.create({
      data: {
        taskResponseId: responseId,
        fieldId,
        kind,
        url: stored.url,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      },
    });
  }
}
