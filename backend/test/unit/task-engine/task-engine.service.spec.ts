import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskStatus } from '@prisma/client';
import { TaskFieldType } from '../../../src/modules/task-engine/task-field-type.enum';
import { TaskEngineService } from '../../../src/modules/task-engine/task-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';
import { ApprovalEngineService } from '../../../src/modules/approval-engine/approval-engine.service';

describe('TaskEngineService — Dynamic Forms', () => {
  let service: TaskEngineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      taskTemplate: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      taskTemplateVersion: { create: jest.fn(), findMany: jest.fn() },
      task: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      taskResponse: { create: jest.fn(), findFirst: jest.fn() },
      taskAttachment: { create: jest.fn() },
      team: { findFirst: jest.fn() },
      user: { findMany: jest.fn() },
      approval: { update: jest.fn() },
      recurringTaskSchedule: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        { provide: ApprovalEngineService, useValue: { findFlow: jest.fn(), startApproval: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TaskEngineService);
  });

  describe('createTemplate() — field definition validation', () => {
    it('REJECTS a template with zero fields', async () => {
      await expect(
        service.createTemplate('company-A', 'admin-1', {
          name: 'Empty',
          fields: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('REJECTS a template with duplicate field ids', async () => {
      await expect(
        service.createTemplate('company-A', 'admin-1', {
          name: 'Meter Reading',
          fields: [
            { id: 'f1', type: TaskFieldType.NUMBER, label: 'Reading A' },
            { id: 'f1', type: TaskFieldType.PHOTO, label: 'Reading B' }, // duplicate id
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ACCEPTS a well-formed template with unique field ids', async () => {
      prisma.taskTemplate.create.mockResolvedValue({ id: 'tpl-1', name: 'Meter Reading' });

      const result = await service.createTemplate('company-A', 'admin-1', {
        name: 'Meter Reading',
        fields: [
          { id: 'f1', type: TaskFieldType.NUMBER, label: 'Reading', required: true },
          { id: 'f2', type: TaskFieldType.PHOTO, label: 'Photo of meter', required: true },
        ],
      });

      expect(result.id).toBe('tpl-1');
    });
  });

  describe('submitResponse() — required-field enforcement against the template', () => {
    const templatedTask = {
      id: 'task-1',
      companyId: 'company-A',
      template: {
        approvalFlowId: null,
        fields: [
          { id: 'f1', type: TaskFieldType.NUMBER, label: 'Reading', required: true },
          { id: 'f2', type: TaskFieldType.PHOTO, label: 'Photo', required: true },
        ],
      },
    };

    it('REJECTS a submission missing a required field', async () => {
      jest.spyOn(service, 'findTask').mockResolvedValue(templatedTask as any);

      await expect(
        service.submitResponse('company-A', 'task-1', 'worker-1', {
          answers: { f1: 100 }, // f2 (required PHOTO) missing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('ACCEPTS a submission with all required fields present and marks the task COMPLETED (no approval flow attached)', async () => {
      jest.spyOn(service, 'findTask').mockResolvedValue(templatedTask as any);
      prisma.taskResponse.create.mockResolvedValue({ id: 'resp-1' });
      prisma.task.update.mockResolvedValue({});

      await service.submitResponse('company-A', 'task-1', 'worker-1', {
        answers: { f1: 100, f2: { attachmentId: 'att-1' } },
      });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { status: TaskStatus.COMPLETED },
      });
    });

    it('SKIPS the required check for a field hidden by conditional logic', async () => {
      const taskWithConditional = {
        id: 'task-2',
        companyId: 'company-A',
        template: {
          approvalFlowId: null,
          fields: [
            { id: 'f1', type: TaskFieldType.DROPDOWN, label: 'Has issue?', options: ['yes', 'no'], required: true },
            {
              id: 'f2',
              type: TaskFieldType.TEXT,
              label: 'Describe the issue',
              required: true,
              conditionalLogic: { dependsOnFieldId: 'f1', showWhenEquals: 'yes' },
            },
          ],
        },
      };
      jest.spyOn(service, 'findTask').mockResolvedValue(taskWithConditional as any);
      prisma.taskResponse.create.mockResolvedValue({ id: 'resp-2' });
      prisma.task.update.mockResolvedValue({});

      // f1='no' means f2 is hidden — its own `required: true` must NOT fire.
      await expect(
        service.submitResponse('company-A', 'task-2', 'worker-1', { answers: { f1: 'no' } }),
      ).resolves.toBeDefined();
    });

    it('ENFORCES the required check when the conditional dependency IS met', async () => {
      const taskWithConditional = {
        id: 'task-3',
        companyId: 'company-A',
        template: {
          approvalFlowId: null,
          fields: [
            { id: 'f1', type: TaskFieldType.DROPDOWN, label: 'Has issue?', options: ['yes', 'no'], required: true },
            {
              id: 'f2',
              type: TaskFieldType.TEXT,
              label: 'Describe the issue',
              required: true,
              conditionalLogic: { dependsOnFieldId: 'f1', showWhenEquals: 'yes' },
            },
          ],
        },
      };
      jest.spyOn(service, 'findTask').mockResolvedValue(taskWithConditional as any);

      await expect(
        service.submitResponse('company-A', 'task-3', 'worker-1', { answers: { f1: 'yes' } }), // f2 missing, but now required
      ).rejects.toThrow(BadRequestException);
    });

    it('ENFORCES a numeric max validation rule', async () => {
      const taskWithValidation = {
        id: 'task-4',
        companyId: 'company-A',
        template: {
          approvalFlowId: null,
          fields: [{ id: 'f1', type: TaskFieldType.NUMBER, label: 'Fuel level %', validation: { min: 0, max: 100 } }],
        },
      };
      jest.spyOn(service, 'findTask').mockResolvedValue(taskWithValidation as any);

      await expect(
        service.submitResponse('company-A', 'task-4', 'worker-1', { answers: { f1: 150 } }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTemplate() — versioning (Sprint 7)', () => {
    it('snapshots the PREVIOUS state into TaskTemplateVersion and bumps the version when fields change', async () => {
      prisma.taskTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1',
        companyId: 'company-A',
        name: 'Old name',
        description: 'Old description',
        fields: [{ id: 'f1', type: TaskFieldType.TEXT, label: 'Old field' }],
        version: 1,
      });
      prisma.taskTemplate.update.mockResolvedValue({ id: 'tpl-1', version: 2 });

      await service.updateTemplate('company-A', 'tpl-1', {
        fields: [{ id: 'f1', type: TaskFieldType.TEXT, label: 'New field' }],
      });

      expect(prisma.taskTemplateVersion.create).toHaveBeenCalledWith({
        data: {
          templateId: 'tpl-1',
          version: 1, // the OLD version number, preserved in history
          name: 'Old name',
          description: 'Old description',
          fields: [{ id: 'f1', type: TaskFieldType.TEXT, label: 'Old field' }],
        },
      });
      expect(prisma.taskTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }),
      );
    });

    it('does NOT create a version snapshot for a pure isActive toggle (not a form change)', async () => {
      prisma.taskTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1',
        companyId: 'company-A',
        name: 'Same name',
        description: null,
        fields: [],
        version: 3,
      });
      prisma.taskTemplate.update.mockResolvedValue({ id: 'tpl-1' });

      await service.updateTemplate('company-A', 'tpl-1', { isActive: false });

      expect(prisma.taskTemplateVersion.create).not.toHaveBeenCalled();
      expect(prisma.taskTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 3 }) }), // unchanged
      );
    });
  });

  describe('generateDueRecurringTasks() — recurrence math', () => {
    const baseSchedule = {
      id: 'sched-1',
      companyId: 'company-A',
      title: 'Daily Check',
      description: null,
      templateId: null,
      teamId: null,
      assigneeIds: ['worker-1'],
      timeOfDay: '08:00',
      createdById: 'admin-1',
      isActive: true,
      endDate: null,
    };

    it('DAILY interval=1: generates on the very first occurrence (never generated before)', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'DAILY', interval: 1, daysOfWeek: null, dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: null },
      ]);
      prisma.task.create.mockResolvedValue({ id: 'task-1' });

      const result = await service.generateDueRecurringTasks(new Date('2026-01-05T00:00:00'));

      expect(result.generated).toBe(1);
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ recurringScheduleId: 'sched-1', title: 'Daily Check' }) }),
      );
    });

    it('DAILY interval=2: does NOT generate the day right after the last generation', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'DAILY', interval: 2, daysOfWeek: null, dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: new Date('2026-01-05') },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-01-06T00:00:00'));

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('DAILY interval=2: DOES generate exactly 2 days after the last generation', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'DAILY', interval: 2, daysOfWeek: null, dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: new Date('2026-01-05') },
      ]);
      prisma.task.create.mockResolvedValue({ id: 'task-2' });

      const result = await service.generateDueRecurringTasks(new Date('2026-01-07T00:00:00'));

      expect(result.generated).toBe(1);
    });

    it('WEEKLY: does NOT generate on a day not listed in daysOfWeek', async () => {
      // 2026-01-05 is a Monday (day 1) — schedule only fires on Wednesday (3)
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'WEEKLY', interval: 1, daysOfWeek: [3], dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: null },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-01-05T00:00:00'));

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('WEEKLY: DOES generate on a matching day-of-week with no prior generation', async () => {
      // 2026-01-07 is a Wednesday (day 3)
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'WEEKLY', interval: 1, daysOfWeek: [3], dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: null },
      ]);
      prisma.task.create.mockResolvedValue({ id: 'task-3' });

      const result = await service.generateDueRecurringTasks(new Date('2026-01-07T00:00:00'));

      expect(result.generated).toBe(1);
    });

    it('MONTHLY: DOES generate when today matches dayOfMonth and never generated before', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'MONTHLY', interval: 1, daysOfWeek: null, dayOfMonth: 15, startDate: new Date('2026-01-01'), lastGeneratedAt: null },
      ]);
      prisma.task.create.mockResolvedValue({ id: 'task-4' });

      const result = await service.generateDueRecurringTasks(new Date('2026-02-15T00:00:00'));

      expect(result.generated).toBe(1);
    });

    it('MONTHLY: does NOT generate when today does not match dayOfMonth', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'MONTHLY', interval: 1, daysOfWeek: null, dayOfMonth: 15, startDate: new Date('2026-01-01'), lastGeneratedAt: null },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-02-14T00:00:00'));

      expect(result.generated).toBe(0);
    });

    it('does NOT generate twice on the same day even if called multiple times', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'DAILY', interval: 1, daysOfWeek: null, dayOfMonth: null, startDate: new Date('2026-01-01'), lastGeneratedAt: new Date('2026-01-05T00:00:00') },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-01-05T18:00:00')); // same day, later time

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('auto-deactivates a schedule once its endDate has passed, without generating', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        {
          ...baseSchedule,
          frequency: 'DAILY',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
          startDate: new Date('2026-01-01'),
          lastGeneratedAt: null,
          endDate: new Date('2026-01-10'),
        },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-01-15T00:00:00'));

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
      expect(prisma.recurringTaskSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('does NOT generate before startDate even if the day-of-week/month would otherwise match', async () => {
      prisma.recurringTaskSchedule.findMany.mockResolvedValue([
        { ...baseSchedule, frequency: 'DAILY', interval: 1, daysOfWeek: null, dayOfMonth: null, startDate: new Date('2026-06-01'), lastGeneratedAt: null },
      ]);

      const result = await service.generateDueRecurringTasks(new Date('2026-01-05T00:00:00')); // before startDate

      expect(result.generated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('getTaskReportSummary() — tracking & reports', () => {
    it('computes completion rate EXCLUDING cancelled tasks from the denominator', async () => {
      prisma.task.groupBy.mockResolvedValue([]);
      prisma.task.findMany
        .mockResolvedValueOnce([]) // overdueTasks call
        .mockResolvedValueOnce([
          // 4 total: 2 completed, 1 cancelled, 1 still assigned
          { status: 'COMPLETED', teamId: null, team: null, dueAt: null },
          { status: 'APPROVED', teamId: null, team: null, dueAt: null },
          { status: 'CANCELED', teamId: null, team: null, dueAt: null },
          { status: 'ASSIGNED', teamId: null, team: null, dueAt: null },
        ]);
      prisma.recurringTaskSchedule.count.mockResolvedValue(0);

      const summary = await service.getTaskReportSummary('company-A');

      // denominator = 4 - 1 cancelled = 3; completed = 2 -> rate = 2/3
      expect(summary.completionRate).toBeCloseTo(2 / 3);
      expect(summary.totalTasks).toBe(4);
      expect(summary.completedCount).toBe(2);
    });

    it('counts a task as overdue only if dueAt is past AND status is non-terminal', async () => {
      const now = new Date('2026-03-15T12:00:00');
      prisma.task.groupBy.mockResolvedValue([]);
      prisma.task.findMany
        .mockResolvedValueOnce([{ id: 'overdue-1', status: 'ASSIGNED', dueAt: new Date('2026-03-10'), assignments: [], team: null }])
        .mockResolvedValueOnce([
          { status: 'ASSIGNED', teamId: null, team: null, dueAt: new Date('2026-03-10') }, // overdue
          { status: 'COMPLETED', teamId: null, team: null, dueAt: new Date('2026-03-01') }, // past dueAt but COMPLETED — not overdue
        ]);
      prisma.recurringTaskSchedule.count.mockResolvedValue(0);

      const summary = await service.getTaskReportSummary('company-A');

      expect(summary.overdueCount).toBe(1);
    });

    it('groups totals correctly by team, including an "unassigned" bucket for tasks with no team', async () => {
      prisma.task.groupBy.mockResolvedValue([]);
      prisma.task.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { status: 'ASSIGNED', teamId: 'team-1', team: { id: 'team-1', name: 'Morning Crew' }, dueAt: null },
          { status: 'COMPLETED', teamId: 'team-1', team: { id: 'team-1', name: 'Morning Crew' }, dueAt: null },
          { status: 'ASSIGNED', teamId: null, team: null, dueAt: null },
        ]);
      prisma.recurringTaskSchedule.count.mockResolvedValue(0);

      const summary = await service.getTaskReportSummary('company-A');

      const morningCrew = summary.byTeam.find((t) => t.teamId === 'team-1');
      const unassigned = summary.byTeam.find((t) => t.teamId === null);
      expect(morningCrew).toMatchObject({ total: 2, completed: 1 });
      expect(unassigned).toMatchObject({ total: 1, teamName: 'بلا فريق' });
    });
  });
});
