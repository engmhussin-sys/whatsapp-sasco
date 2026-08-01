import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApprovalActionType, ApprovalStatus, SystemRole } from '@prisma/client';
import { ApprovalEngineService } from '../../../src/modules/approval-engine/approval-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';

describe('ApprovalEngineService — Workflow Engine (Worker -> Supervisor -> Manager)', () => {
  let service: ApprovalEngineService;
  let prisma: any;

  const supervisorRoleId = 'role-supervisor';
  const managerRoleId = 'role-manager';

  const twoStepFlow = {
    id: 'flow-1',
    companyId: 'company-A',
    isActive: true,
    steps: [
      { stepOrder: 1, approverRoleId: supervisorRoleId, approverRole: { name: 'Supervisor' } },
      { stepOrder: 2, approverRoleId: managerRoleId, approverRole: { name: 'Manager' } },
    ],
  };

  function buildApproval(overrides: Partial<any> = {}) {
    return {
      id: 'approval-1',
      companyId: 'company-A',
      flowId: 'flow-1',
      currentStep: 1,
      status: ApprovalStatus.PENDING,
      flow: twoStepFlow,
      actions: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      role: { findMany: jest.fn() },
      approvalFlow: { create: jest.fn(), findFirst: jest.fn() },
      approval: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      approvalAction: { create: jest.fn() },
      user: { findFirst: jest.fn() },
      userRole: { findUnique: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ApprovalEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ApprovalEngineService);
  });

  describe('act() — role gating per step', () => {
    it('BLOCKS a plain Worker from approving step 1 (requires the Supervisor role)', async () => {
      const approval = buildApproval();
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'worker-1', systemRole: SystemRole.WORKER });
      prisma.userRole.findUnique.mockResolvedValue(null); // worker does NOT hold the Supervisor role

      await expect(
        service.act('company-A', 'approval-1', 'worker-1', ApprovalActionType.APPROVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ALLOWS a user holding the Supervisor role to approve step 1, advancing to step 2', async () => {
      const approval = buildApproval();
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'sup-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'sup-1', roleId: supervisorRoleId });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.PENDING, currentStep: 2 });

      const result = await service.act('company-A', 'approval-1', 'sup-1', ApprovalActionType.APPROVE);

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ApprovalStatus.PENDING, currentStep: 2 }, // NOT yet fully approved — one step left
        }),
      );
    });

    it('BLOCKS the Supervisor from approving step 2 (that step requires the Manager role)', async () => {
      const approval = buildApproval({ currentStep: 2 });
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'sup-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue(null); // holds Supervisor, not Manager

      await expect(
        service.act('company-A', 'approval-1', 'sup-1', ApprovalActionType.APPROVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it('marks the approval fully APPROVED once the Manager approves the final step', async () => {
      const approval = buildApproval({ currentStep: 2 });
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'mgr-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'mgr-1', roleId: managerRoleId });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.APPROVED, currentStep: 2 });

      await service.act('company-A', 'approval-1', 'mgr-1', ApprovalActionType.APPROVE);

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApprovalStatus.APPROVED, currentStep: 2 } }),
      );
    });

    it('allows a COMPANY_ADMIN to act on any step (administrative override)', async () => {
      const approval = buildApproval();
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1', systemRole: SystemRole.COMPANY_ADMIN });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.PENDING, currentStep: 2 });

      await service.act('company-A', 'approval-1', 'admin-1', ApprovalActionType.APPROVE);

      // Admin override never even checks userRole for the step.
      expect(prisma.userRole.findUnique).not.toHaveBeenCalled();
    });

    it('REJECT is terminal regardless of step', async () => {
      const approval = buildApproval();
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'sup-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'sup-1', roleId: supervisorRoleId });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.REJECTED, currentStep: 1 });

      await service.act('company-A', 'approval-1', 'sup-1', ApprovalActionType.REJECT);

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApprovalStatus.REJECTED, currentStep: 1 } }),
      );
    });

    it('RETURN resets to step 1 for resubmission', async () => {
      const approval = buildApproval({ currentStep: 2 });
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'mgr-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'mgr-1', roleId: managerRoleId });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.RETURNED, currentStep: 1 });

      await service.act('company-A', 'approval-1', 'mgr-1', ApprovalActionType.RETURN);

      expect(prisma.approval.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: ApprovalStatus.RETURNED, currentStep: 1 } }),
      );
    });

    it('REJECTS acting again on an already-decided (non-PENDING) approval', async () => {
      const approval = buildApproval({ status: ApprovalStatus.APPROVED });
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);

      await expect(
        service.act('company-A', 'approval-1', 'anyone', ApprovalActionType.APPROVE),
      ).rejects.toThrow(BadRequestException);
    });

    it('every action call writes an ApprovalAction row (audit trail)', async () => {
      const approval = buildApproval();
      jest.spyOn(service, 'findOne').mockResolvedValue(approval as any);
      prisma.user.findFirst.mockResolvedValue({ id: 'sup-1', systemRole: SystemRole.TEAM_LEAD });
      prisma.userRole.findUnique.mockResolvedValue({ userId: 'sup-1', roleId: supervisorRoleId });
      prisma.approvalAction.create.mockResolvedValue({});
      prisma.approval.update.mockResolvedValue({ status: ApprovalStatus.PENDING, currentStep: 2 });

      await service.act('company-A', 'approval-1', 'sup-1', ApprovalActionType.APPROVE, 'Looks good');

      expect(prisma.approvalAction.create).toHaveBeenCalledWith({
        data: {
          approvalId: 'approval-1',
          stepOrder: 1,
          actorId: 'sup-1',
          action: ApprovalActionType.APPROVE,
          comment: 'Looks good',
        },
      });
    });
  });

  describe('createFlow() — tenant-scoped role validation', () => {
    it('REJECTS a flow step referencing a role that belongs to a different company', async () => {
      prisma.role.findMany.mockResolvedValue([{ id: supervisorRoleId }]); // only 1 of 2 roles resolved = other belongs elsewhere

      await expect(
        service.createFlow('company-A', 'admin-1', {
          name: 'Fuel Request Approval',
          entityType: 'FuelRequest',
          steps: [
            { name: 'Supervisor Review', approverRoleId: supervisorRoleId },
            { name: 'Manager Review', approverRoleId: 'role-from-company-B' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
