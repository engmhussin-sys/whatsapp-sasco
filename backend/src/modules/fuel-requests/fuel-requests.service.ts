import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalActionType, ApprovalStatus, AuditAction, FuelRequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ApprovalEngineService } from '../approval-engine/approval-engine.service';
import { CreateFuelRequestDto } from './dto/fuel-requests.dto';

/**
 * DOMAIN MODULE — the flagship example of how a sector-specific feature
 * should be built on top of the generic engines: this module owns ZERO
 * workflow logic itself. Every Approve/Reject/Return decision is made
 * by ApprovalEngineService; this module only (a) starts the approval
 * when a request is created and (b) mirrors the Approval's generic
 * status into its own richer, fuel-station-specific FuelRequestStatus
 * enum for fast list/filter queries in the UI.
 *
 * NOTE ON THE STATUS MAPPING: FuelRequestStatus (PENDING_SUPERVISOR /
 * PENDING_MANAGER) assumes the classic 2-step Worker->Supervisor->Manager
 * chain, which is why this mapping is domain-specific and lives HERE,
 * not in the engine. A future domain module with a different step count
 * (e.g. a 4-step purchase-order approval) would define its own enum and
 * its own mapping function — the engine itself never encodes step counts.
 */
@Injectable()
export class FuelRequestsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private approvalEngine: ApprovalEngineService,
  ) {}

  private mapApprovalToFuelRequestStatus(approval: { status: ApprovalStatus; currentStep: number }): FuelRequestStatus {
    switch (approval.status) {
      case ApprovalStatus.APPROVED:
      case ApprovalStatus.COMPLETED:
        return FuelRequestStatus.APPROVED;
      case ApprovalStatus.REJECTED:
        return FuelRequestStatus.REJECTED;
      case ApprovalStatus.RETURNED:
      case ApprovalStatus.CANCELED:
        return FuelRequestStatus.DRAFT;
      case ApprovalStatus.PENDING:
      default:
        return approval.currentStep <= 1 ? FuelRequestStatus.PENDING_SUPERVISOR : FuelRequestStatus.PENDING_MANAGER;
    }
  }

  async create(companyId: string, actorId: string, dto: CreateFuelRequestDto) {
    const [station, tank] = await Promise.all([
      this.prisma.station.findFirst({ where: { id: dto.stationId, companyId } }),
      this.prisma.tank.findFirst({ where: { id: dto.tankId, station: { companyId } } }),
    ]);
    if (!station) throw new NotFoundException('Station not found');
    if (!tank || tank.stationId !== dto.stationId) throw new NotFoundException('Tank not found at this station');

    const flowId =
      dto.approvalFlowId ??
      (
        await this.prisma.approvalFlow.findFirst({
          where: { companyId, entityType: 'FuelRequest', isActive: true },
        })
      )?.id;
    if (!flowId) {
      throw new BadRequestException(
        'No active ApprovalFlow configured for FuelRequest — a Company Admin must create one first',
      );
    }

    const fuelRequest = await this.prisma.fuelRequest.create({
      data: {
        companyId,
        stationId: dto.stationId,
        tankId: dto.tankId,
        requestedById: actorId,
        currentLevel: dto.currentLevel,
        requestedQuantity: dto.requestedQuantity,
        photoUrl: dto.photoUrl,
        notes: dto.notes,
        status: FuelRequestStatus.PENDING_SUPERVISOR,
      },
    });

    const approval = await this.approvalEngine.startApproval(companyId, actorId, {
      flowId,
      entityType: 'FuelRequest',
      entityId: fuelRequest.id,
    });

    const updated = await this.prisma.fuelRequest.update({
      where: { id: fuelRequest.id },
      data: { approvalId: approval.id },
    });

    await this.auditLogs.record({
      companyId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'FuelRequest',
      entityId: fuelRequest.id,
      metadata: { stationId: dto.stationId, tankId: dto.tankId, requestedQuantity: dto.requestedQuantity },
    });

    return updated;
  }

  findAll(companyId: string, params: { status?: FuelRequestStatus; stationId?: string }) {
    return this.prisma.fuelRequest.findMany({
      where: { companyId, ...(params.status ? { status: params.status } : {}), ...(params.stationId ? { stationId: params.stationId } : {}) },
      include: { station: true, tank: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const fuelRequest = await this.prisma.fuelRequest.findFirst({
      where: { id, companyId },
      include: { station: true, tank: true },
    });
    if (!fuelRequest) throw new NotFoundException('Fuel request not found');
    return fuelRequest;
  }

  async act(companyId: string, id: string, actorId: string, action: ApprovalActionType, comment?: string) {
    const fuelRequest = await this.findOne(companyId, id);
    if (!fuelRequest.approvalId) throw new BadRequestException('This fuel request has no associated approval');

    const approval = await this.approvalEngine.act(companyId, fuelRequest.approvalId, actorId, action, comment);

    const updated = await this.prisma.fuelRequest.update({
      where: { id },
      data: { status: this.mapApprovalToFuelRequestStatus(approval) },
    });

    return updated;
  }
}
