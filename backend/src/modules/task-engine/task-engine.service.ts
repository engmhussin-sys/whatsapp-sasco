import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TaskStatus, AuditAction, RecurrenceFrequency } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ApprovalEngineService } from '../approval-engine/approval-engine.service';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CreateTaskDto,
  SubmitTaskResponseDto,
  TaskFieldDefinitionDto,
  CreateRecurringTaskScheduleDto,
  UpdateRecurringTaskScheduleDto,
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
  private readonly logger = new Logger(TaskEngineService.name);

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
    const existing = await this.findTemplate(companyId, id);
    if (dto.fields) this.validateFieldDefinitions(dto.fields);

    // Sprint 7 (Form Builder) — only snapshot + bump the version when
    // something that actually defines the FORM changed (fields, name,
    // description). A pure isActive toggle, for example, doesn't
    // warrant a new version entry — it's not a different form.
    const isFormChange = dto.fields !== undefined || dto.name !== undefined || dto.description !== undefined;

    return this.prisma.$transaction(async (tx: any) => {
      if (isFormChange) {
        await tx.taskTemplateVersion.create({
          data: {
            templateId: id,
            version: existing.version,
            name: existing.name,
            description: existing.description,
            fields: existing.fields,
          },
        });
      }

      return tx.taskTemplate.update({
        where: { id },
        data: {
          ...dto,
          fields: dto.fields as any,
          version: isFormChange ? existing.version + 1 : existing.version,
        },
      });
    });
  }

  /** Sprint 7 (Form Builder) — browsable version history for the
   * `forms` screen's versioning UI. */
  async getTemplateVersions(companyId: string, id: string) {
    await this.findTemplate(companyId, id);
    return this.prisma.taskTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
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
      include: { template: true, assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Task management module — reports/tracking. Aggregated on the server
   * (not computed client-side from a full task list) so this stays fast
   * as task volume grows; a company with thousands of tasks shouldn't
   * ship them all to the browser just to count them. "Overdue" excludes
   * terminal statuses — a COMPLETED task with a past dueAt isn't late,
   * it's done. */
  async getTaskReportSummary(companyId: string) {
    const now = new Date();
    const terminalStatuses: TaskStatus[] = [TaskStatus.COMPLETED, TaskStatus.APPROVED, TaskStatus.CANCELED];

    const [statusCounts, overdueTasks, allForTeamBreakdown, activeRecurringCount] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
      this.prisma.task.findMany({
        where: { companyId, dueAt: { lt: now }, status: { notIn: terminalStatuses } },
        include: { assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, team: true },
        orderBy: { dueAt: 'asc' },
        take: 50,
      }),
      this.prisma.task.findMany({
        where: { companyId },
        select: { status: true, teamId: true, team: { select: { id: true, name: true } }, dueAt: true },
      }),
      this.prisma.recurringTaskSchedule.count({ where: { companyId, isActive: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts as { status: TaskStatus; _count: { _all: number } }[]) {
      byStatus[row.status] = row._count._all;
    }

    const totalTasks = allForTeamBreakdown.length;
    type TeamBreakdownRow = { status: TaskStatus; teamId: string | null; team: { id: string; name: string } | null; dueAt: Date | null };
    const completedCount = (allForTeamBreakdown as TeamBreakdownRow[]).filter(
      (t) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED,
    ).length;
    const cancelledCount = (allForTeamBreakdown as TeamBreakdownRow[]).filter((t) => t.status === TaskStatus.CANCELED).length;
    // Cancelled tasks were never "due" to be completed — excluding them
    // from the denominator avoids understating completion rate for
    // companies that cancel stale/duplicate tasks regularly.
    const completionDenominator = totalTasks - cancelledCount;
    const completionRate = completionDenominator > 0 ? completedCount / completionDenominator : null;

    const teamMap = new Map<string, { teamId: string | null; teamName: string; total: number; completed: number; overdue: number }>();
    for (const t of allForTeamBreakdown) {
      const key = t.teamId ?? 'unassigned';
      if (!teamMap.has(key)) {
        teamMap.set(key, { teamId: t.teamId, teamName: t.team?.name ?? 'بلا فريق', total: 0, completed: 0, overdue: 0 });
      }
      const entry = teamMap.get(key)!;
      entry.total++;
      if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.APPROVED) entry.completed++;
      if (t.dueAt && t.dueAt < now && !terminalStatuses.includes(t.status)) entry.overdue++;
    }

    return {
      totalTasks,
      byStatus,
      completedCount,
      completionRate,
      overdueCount: overdueTasks.length,
      overdueTasks,
      byTeam: Array.from(teamMap.values()).sort((a, b) => b.total - a.total),
      activeRecurringSchedules: activeRecurringCount,
      generatedAt: now,
    };
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
   * BUG FIX (product audit: TaskStatus.IN_PROGRESS existed in the enum
   * and mobile's canSubmit check but no endpoint ever set it — the
   * status was completely dead. Workers had no way to signal "I've
   * started this" between assignment and final submission). Restricted
   * to an actual assignee — otherwise any worker could start (and thus
   * appear to be working on) someone else's task.
   */
  async startTask(companyId: string, taskId: string, actorId: string) {
    const task = await this.findTask(companyId, taskId);

    const isAssignee = task.assignments.some((a: { userId: string }) => a.userId === actorId);
    if (!isAssignee) throw new ForbiddenException('Only an assigned worker can start this task');

    if (task.status !== TaskStatus.ASSIGNED) {
      throw new BadRequestException(`Cannot start a task in status ${task.status} — must be ASSIGNED`);
    }

    await this.prisma.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS } });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Task',
      entityId: taskId,
      metadata: { statusChange: 'ASSIGNED -> IN_PROGRESS' },
    });

    return this.findTask(companyId, taskId);
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
      // Sprint 7 (Form Builder) — a field hidden by conditional logic
      // (its dependency's answer doesn't match showWhenEquals) is never
      // required, regardless of its own `required` flag — the person
      // submitting the form literally never saw it.
      if (field.conditionalLogic) {
        const dependencyAnswer = answers[field.conditionalLogic.dependsOnFieldId];
        if (String(dependencyAnswer) !== field.conditionalLogic.showWhenEquals) continue;
      }

      const value = answers[field.id];
      const isEmpty = value === undefined || value === null || value === '';

      if (field.required && isEmpty) {
        throw new BadRequestException(`Field "${field.label}" (${field.id}) is required`);
      }
      if (isEmpty || !field.validation) continue;

      const v = field.validation;
      if (typeof value === 'number') {
        if (v.min !== undefined && value < v.min) {
          throw new BadRequestException(`Field "${field.label}" must be at least ${v.min}`);
        }
        if (v.max !== undefined && value > v.max) {
          throw new BadRequestException(`Field "${field.label}" must be at most ${v.max}`);
        }
      }
      if (typeof value === 'string') {
        if (v.minLength !== undefined && value.length < v.minLength) {
          throw new BadRequestException(`Field "${field.label}" must be at least ${v.minLength} characters`);
        }
        if (v.maxLength !== undefined && value.length > v.maxLength) {
          throw new BadRequestException(`Field "${field.label}" must be at most ${v.maxLength} characters`);
        }
        if (v.pattern && !new RegExp(v.pattern).test(value)) {
          throw new BadRequestException(`Field "${field.label}" does not match the required format`);
        }
      }
    }
  }

  async addAttachmentToResponse(
    companyId: string,
    responseId: string,
    fieldId: string,
    kind: any,
    stored: { url: string; sizeBytes?: number },
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
        sizeBytes: stored.sizeBytes,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      },
    });
  }

  // ==========================================================================
  // Task management module — recurrence
  // ==========================================================================

  async createRecurringSchedule(companyId: string, actorId: string, dto: CreateRecurringTaskScheduleDto) {
    if (dto.templateId) await this.findTemplate(companyId, dto.templateId);

    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, companyId } });
      if (!team) throw new NotFoundException('Team not found');
    }

    const users = await this.prisma.user.findMany({ where: { id: { in: dto.assigneeIds }, companyId }, select: { id: true } });
    if (users.length !== dto.assigneeIds.length) {
      throw new BadRequestException('One or more assignees do not belong to this company');
    }

    if (dto.frequency === RecurrenceFrequency.WEEKLY && (!dto.daysOfWeek || dto.daysOfWeek.length === 0)) {
      throw new BadRequestException('daysOfWeek is required for WEEKLY frequency');
    }
    if (dto.frequency === RecurrenceFrequency.MONTHLY && !dto.dayOfMonth) {
      throw new BadRequestException('dayOfMonth is required for MONTHLY frequency');
    }
    if (!/^\d{2}:\d{2}$/.test(dto.timeOfDay)) {
      throw new BadRequestException('timeOfDay must be in "HH:mm" format');
    }

    const schedule = await this.prisma.recurringTaskSchedule.create({
      data: {
        companyId,
        title: dto.title,
        description: dto.description,
        templateId: dto.templateId,
        teamId: dto.teamId,
        assigneeIds: dto.assigneeIds,
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        daysOfWeek: dto.daysOfWeek,
        dayOfMonth: dto.dayOfMonth,
        timeOfDay: dto.timeOfDay,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdById: actorId,
      },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'RecurringTaskSchedule',
      entityId: schedule.id,
      metadata: { title: schedule.title, frequency: schedule.frequency },
    });

    return schedule;
  }

  findRecurringSchedules(companyId: string) {
    return this.prisma.recurringTaskSchedule.findMany({
      where: { companyId },
      include: { template: true, team: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRecurringSchedule(companyId: string, id: string) {
    const schedule = await this.prisma.recurringTaskSchedule.findFirst({
      where: { id, companyId },
      include: { template: true, team: true, generatedTasks: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!schedule) throw new NotFoundException('Recurring schedule not found');
    return schedule;
  }

  async updateRecurringSchedule(companyId: string, id: string, dto: UpdateRecurringTaskScheduleDto) {
    await this.findRecurringSchedule(companyId, id);
    return this.prisma.recurringTaskSchedule.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  /** true إن كانت [date] مُستحَقة التوليد اليوم وفق نمط تكرار [schedule] —
   * منطق حاسم لا يعتمد على re-scanning كل مهمة مُولَّدة سابقاً، فقط
   * lastGeneratedAt (أو startDate إن لم يُولَّد شيء بعد). */
  private isDueToday(
    schedule: { frequency: RecurrenceFrequency; interval: number; daysOfWeek: unknown; dayOfMonth: number | null; startDate: Date; lastGeneratedAt: Date | null },
    today: Date,
  ): boolean {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayStart = startOfDay(today);
    const startDateStart = startOfDay(schedule.startDate);
    if (todayStart < startDateStart) return false;

    const lastGenStart = schedule.lastGeneratedAt ? startOfDay(schedule.lastGeneratedAt) : null;
    if (lastGenStart && lastGenStart.getTime() === todayStart.getTime()) return false; // already generated today

    switch (schedule.frequency) {
      case RecurrenceFrequency.DAILY: {
        const sinceStart = lastGenStart ?? startDateStart;
        const daysSince = Math.round((todayStart.getTime() - sinceStart.getTime()) / 86_400_000);
        return lastGenStart ? daysSince >= schedule.interval : true; // first occurrence always fires on/after startDate
      }
      case RecurrenceFrequency.WEEKLY: {
        const days = (schedule.daysOfWeek as number[] | null) ?? [];
        if (!days.includes(todayStart.getDay())) return false;
        if (!lastGenStart) return true;
        const weeksSince = Math.floor((todayStart.getTime() - lastGenStart.getTime()) / (7 * 86_400_000));
        return weeksSince >= schedule.interval - 1; // interval=1 means every matching day-of-week, no skipped weeks
      }
      case RecurrenceFrequency.MONTHLY: {
        if (todayStart.getDate() !== schedule.dayOfMonth) return false;
        if (!lastGenStart) return true;
        const monthsSince =
          (todayStart.getFullYear() - lastGenStart.getFullYear()) * 12 + (todayStart.getMonth() - lastGenStart.getMonth());
        return monthsSince >= schedule.interval;
      }
      default:
        return false;
    }
  }

  /** يُستدعى مرة يومياً (منتصف الليل، توقيت الخادم) — يفحص كل الجداول
   * النشطة، ويُنشئ Task فعلية لأي جدول مُستحَق اليوم. مُصمَّمة كدالة
   * عامة (وليست private) لتُختبَر مباشرة من الاختبارات بلا انتظار
   * الجدولة الفعلية. */
  async generateDueRecurringTasks(now: Date = new Date()) {
    const schedules = await this.prisma.recurringTaskSchedule.findMany({ where: { isActive: true } });
    let generated = 0;

    for (const schedule of schedules) {
      if (schedule.endDate && now > schedule.endDate) {
        await this.prisma.recurringTaskSchedule.update({ where: { id: schedule.id }, data: { isActive: false } });
        continue;
      }

      if (!this.isDueToday(schedule, now)) continue;

      const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
      const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const assigneeIds = schedule.assigneeIds as string[];

      const task = await this.prisma.task.create({
        data: {
          companyId: schedule.companyId,
          templateId: schedule.templateId,
          teamId: schedule.teamId,
          title: schedule.title,
          description: schedule.description,
          dueAt,
          createdById: schedule.createdById,
          recurringScheduleId: schedule.id,
          status: assigneeIds.length ? TaskStatus.ASSIGNED : TaskStatus.DRAFT,
          assignments: assigneeIds.length ? { create: assigneeIds.map((userId) => ({ userId })) } : undefined,
        },
      });

      await this.prisma.recurringTaskSchedule.update({ where: { id: schedule.id }, data: { lastGeneratedAt: now } });

      await this.auditLogs.record({
        companyId: schedule.companyId,
        actorId: schedule.createdById,
        action: AuditAction.CREATE,
        entityType: 'Task',
        entityId: task.id,
        metadata: { generatedFromScheduleId: schedule.id },
      });

      generated++;
    }

    this.logger.log(`generateDueRecurringTasks: ${generated} task(s) generated from ${schedules.length} active schedule(s)`);
    return { generated };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRecurringTaskGeneration() {
    await this.generateDueRecurringTasks();
  }
}
