import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalActionType, ApprovalStatus, SystemRole, AuditAction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateApprovalFlowDto, StartApprovalDto } from './dto/approval-engine.dto';

/**
 * GENERIC APPROVAL / WORKFLOW ENGINE
 * -----------------------------------------------------------------------
 * Deliberately has ZERO knowledge of "fuel stations" or any other
 * domain concept. It only understands:
 *   - ApprovalFlow: an ordered list of ApprovalStep (each tied to a
 *     per-company Role, e.g. "Supervisor", "Manager" — so the classic
 *     Worker -> Supervisor -> Manager chain is just a 2-step flow with
 *     no worker step, since the WORKER is the entity's creator, not an
 *     approval step).
 *   - Approval: one instance of an arbitrary domain entity
 *     (entityType + entityId, polymorphic — no FK to any domain table)
 *     moving through those steps.
 *   - ApprovalAction: the audit trail of every decision.
 *
 * Domain modules (FuelRequestsModule, and any future one — inspections,
 * purchase orders, leave requests, ...) call `startApproval()` after
 * creating their own record, and `act()` when a step's approver responds.
 * They listen to the resulting Approval.status to update their own
 * denormalized status field for fast querying (see FuelRequestsService).
 */
@Injectable()
export class ApprovalEngineService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async createFlow(companyId: string, actorId: string, dto: CreateApprovalFlowDto) {
    if (dto.steps.length === 0) {
      throw new BadRequestException('An approval flow needs at least one step');
    }

    // Verify every referenced role belongs to this tenant (or is a shared system role).
    const roleIds = dto.steps.map((s) => s.approverRoleId);
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, OR: [{ companyId }, { companyId: null, isSystem: true }] },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException('One or more approverRoleId values are invalid for this company');
    }

    const flow = await this.prisma.approvalFlow.create({
      data: {
        companyId,
        name: dto.name,
        entityType: dto.entityType,
        steps: {
          create: dto.steps.map((s, index) => ({
            stepOrder: index + 1,
            name: s.name,
            approverRoleId: s.approverRoleId,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ApprovalFlow',
      entityId: flow.id,
      metadata: { name: flow.name, stepCount: flow.steps.length },
    });

    return flow;
  }

  findAllFlows(companyId: string) {
    return this.prisma.approvalFlow.findMany({
      where: { companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lists Approvals for a tenant, optionally narrowed to only those the
   * given user is actually entitled to act on right now (their role
   * matches the ApprovalStep at each approval's currentStep, or they
   * hold an administrative override role). This is what powers a
   * "My Approvals" / pending-action inbox screen without ever needing
   * mock data — it re-uses the exact same authorization logic as act().
   */
  async findAllApprovals(
    companyId: string,
    params: { status?: ApprovalStatus; entityType?: string; actionableByUserId?: string },
  ) {
    const approvals = await this.prisma.approval.findMany({
      where: {
        companyId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.entityType ? { entityType: params.entityType } : {}),
      },
      include: {
        flow: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: true } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!params.actionableByUserId) return approvals;

    const user = await this.prisma.user.findFirst({ where: { id: params.actionableByUserId, companyId } });
    if (!user) return [];
    if (user.systemRole === SystemRole.COMPANY_ADMIN || user.systemRole === SystemRole.SUPER_ADMIN) {
      return approvals; // administrative override sees everything
    }

    const userRoleIds = new Set(
      (await this.prisma.userRole.findMany({ where: { userId: params.actionableByUserId } })).map((r: { roleId: string }) => r.roleId),
    );

    return approvals.filter((a: any) => {
      if (a.status !== ApprovalStatus.PENDING) return false;
      const currentStepDef = a.flow.steps.find((s: any) => s.stepOrder === a.currentStep);
      return currentStepDef ? userRoleIds.has(currentStepDef.approverRoleId) : false;
    });
  }

  async findFlow(companyId: string, id: string) {
    const flow = await this.prisma.approvalFlow.findFirst({
      where: { id, companyId },
      include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: true } } },
    });
    if (!flow) throw new NotFoundException('Approval flow not found');
    return flow;
  }

  /** Called by a domain module right after it creates the record that needs approval. */
  async startApproval(companyId: string, actorId: string, dto: StartApprovalDto) {
    const flow = await this.findFlow(companyId, dto.flowId);
    if (!flow.isActive) throw new BadRequestException('This approval flow is inactive');

    const approval = await this.prisma.approval.create({
      data: {
        companyId,
        flowId: dto.flowId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        currentStep: 1,
        status: ApprovalStatus.PENDING,
        createdById: actorId,
      },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Approval',
      entityId: approval.id,
      metadata: { flowId: dto.flowId, targetEntity: `${dto.entityType}:${dto.entityId}` },
    });

    return approval;
  }

  async findOne(companyId: string, id: string) {
    const approval = await this.prisma.approval.findFirst({
      where: { id, companyId },
      include: {
        flow: { include: { steps: { orderBy: { stepOrder: 'asc' }, include: { approverRole: true } } } },
        actions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    return approval;
  }

  /**
   * Determines whether `userId` is authorized to act on the CURRENT step
   * of `approval`. A user is authorized if either:
   *   (a) they hold the Role assigned to the current ApprovalStep, or
   *   (b) they are a COMPANY_ADMIN/SUPER_ADMIN (administrative override,
   *       common in enterprise workflow tools and useful for exception
   *       handling — always fully audited via ApprovalAction.actorId).
   */
  private async assertCanActOnCurrentStep(companyId: string, approval: any, userId: string) {
    const currentStepDef = approval.flow.steps.find((s: any) => s.stepOrder === approval.currentStep);
    if (!currentStepDef) throw new BadRequestException('Approval flow has no matching step definition');

    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new ForbiddenException('User not found in this company');

    if (user.systemRole === SystemRole.COMPANY_ADMIN || user.systemRole === SystemRole.SUPER_ADMIN) {
      return; // administrative override
    }

    const hasRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: currentStepDef.approverRoleId } },
    });
    if (!hasRole) {
      throw new ForbiddenException(
        `Only users with the "${currentStepDef.approverRole?.name ?? currentStepDef.approverRoleId}" role can act on this step`,
      );
    }
  }

  async act(companyId: string, approvalId: string, actorId: string, action: ApprovalActionType, comment?: string) {
    const approval = await this.findOne(companyId, approvalId);

    if (action !== ApprovalActionType.COMMENT) {
      if (approval.status !== ApprovalStatus.PENDING) {
        throw new BadRequestException(`Cannot act on an approval with status ${approval.status}`);
      }
      await this.assertCanActOnCurrentStep(companyId, approval, actorId);
    }

    const isLastStep = approval.currentStep >= approval.flow.steps.length;

    let nextStatus: ApprovalStatus = approval.status;
    let nextStep = approval.currentStep;

    switch (action) {
      case ApprovalActionType.APPROVE:
        nextStatus = isLastStep ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING;
        nextStep = isLastStep ? approval.currentStep : approval.currentStep + 1;
        break;
      case ApprovalActionType.REJECT:
        nextStatus = ApprovalStatus.REJECTED;
        break;
      case ApprovalActionType.RETURN:
        nextStatus = ApprovalStatus.RETURNED;
        nextStep = 1; // sent back to the start; domain module decides whether/how to resubmit
        break;
      case ApprovalActionType.COMMENT:
        // no status/step change — comment-only audit entry
        break;
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.approvalAction.create({
        data: {
          approvalId,
          stepOrder: approval.currentStep,
          actorId,
          action,
          comment,
        },
      }),
      this.prisma.approval.update({
        where: { id: approvalId },
        data: { status: nextStatus, currentStep: nextStep },
        include: { actions: { orderBy: { createdAt: 'asc' } }, flow: { include: { steps: true } } },
      }),
    ]);

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Approval',
      entityId: approvalId,
      metadata: { action, comment, newStatus: nextStatus },
    });

    return updated;
  }
}
