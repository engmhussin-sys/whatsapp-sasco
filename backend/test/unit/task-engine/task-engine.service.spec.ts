import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskFieldType, TaskStatus } from '@prisma/client';
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
      task: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      taskResponse: { create: jest.fn(), findFirst: jest.fn() },
      taskAttachment: { create: jest.fn() },
      team: { findFirst: jest.fn() },
      user: { findMany: jest.fn() },
      approval: { update: jest.fn() },
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
  });
});
