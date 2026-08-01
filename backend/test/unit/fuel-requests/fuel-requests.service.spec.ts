import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApprovalActionType, ApprovalStatus, FuelRequestStatus } from '@prisma/client';
import { FuelRequestsService } from '../../../src/modules/fuel-requests/fuel-requests.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';
import { AuditLogsService } from '../../../src/modules/audit-logs/audit-logs.service';
import { ApprovalEngineService } from '../../../src/modules/approval-engine/approval-engine.service';

describe('FuelRequestsService — Domain Module on top of the generic Approval Engine', () => {
  let service: FuelRequestsService;
  let prisma: any;
  let approvalEngine: any;

  beforeEach(async () => {
    prisma = {
      station: { findFirst: jest.fn() },
      tank: { findFirst: jest.fn() },
      approvalFlow: { findFirst: jest.fn() },
      fuelRequest: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    };
    approvalEngine = { startApproval: jest.fn(), act: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FuelRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        { provide: ApprovalEngineService, useValue: approvalEngine },
      ],
    }).compile();

    service = moduleRef.get(FuelRequestsService);
  });

  it('REJECTS creation when the station belongs to a different company (tenant isolation)', async () => {
    prisma.station.findFirst.mockResolvedValue(null); // scoped query found nothing

    await expect(
      service.create('company-A', 'worker-1', {
        stationId: 'station-in-company-B',
        tankId: 'tank-1',
        currentLevel: 10,
        requestedQuantity: 500,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('REJECTS creation when the tank does not belong to the specified station', async () => {
    prisma.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prisma.tank.findFirst.mockResolvedValue({ id: 'tank-1', stationId: 'a-different-station' });

    await expect(
      service.create('company-A', 'worker-1', {
        stationId: 'station-1',
        tankId: 'tank-1',
        currentLevel: 10,
        requestedQuantity: 500,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('REJECTS creation when the company has no ApprovalFlow configured for FuelRequest', async () => {
    prisma.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prisma.tank.findFirst.mockResolvedValue({ id: 'tank-1', stationId: 'station-1' });
    prisma.approvalFlow.findFirst.mockResolvedValue(null);

    await expect(
      service.create('company-A', 'worker-1', {
        stationId: 'station-1',
        tankId: 'tank-1',
        currentLevel: 10,
        requestedQuantity: 500,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('starts an Approval and links it to the FuelRequest on successful creation', async () => {
    prisma.station.findFirst.mockResolvedValue({ id: 'station-1' });
    prisma.tank.findFirst.mockResolvedValue({ id: 'tank-1', stationId: 'station-1' });
    prisma.approvalFlow.findFirst.mockResolvedValue({ id: 'flow-1' });
    prisma.fuelRequest.create.mockResolvedValue({ id: 'fr-1' });
    approvalEngine.startApproval.mockResolvedValue({ id: 'approval-1' });
    prisma.fuelRequest.update.mockResolvedValue({ id: 'fr-1', approvalId: 'approval-1' });

    await service.create('company-A', 'worker-1', {
      stationId: 'station-1',
      tankId: 'tank-1',
      currentLevel: 10,
      requestedQuantity: 500,
    });

    expect(approvalEngine.startApproval).toHaveBeenCalledWith('company-A', 'worker-1', {
      flowId: 'flow-1',
      entityType: 'FuelRequest',
      entityId: 'fr-1',
    });
    expect(prisma.fuelRequest.update).toHaveBeenCalledWith({
      where: { id: 'fr-1' },
      data: { approvalId: 'approval-1' },
    });
  });

  describe('act() — status mirrors the underlying Approval', () => {
    beforeEach(() => {
      prisma.fuelRequest.findFirst.mockResolvedValue({ id: 'fr-1', companyId: 'company-A', approvalId: 'approval-1' });
    });

    it('maps step-1 PENDING approval to PENDING_SUPERVISOR', async () => {
      approvalEngine.act.mockResolvedValue({ status: ApprovalStatus.PENDING, currentStep: 1 });
      prisma.fuelRequest.update.mockResolvedValue({ status: FuelRequestStatus.PENDING_SUPERVISOR });

      await service.act('company-A', 'fr-1', 'supervisor-1', ApprovalActionType.APPROVE);

      expect(prisma.fuelRequest.update).toHaveBeenCalledWith({
        where: { id: 'fr-1' },
        data: { status: FuelRequestStatus.PENDING_SUPERVISOR },
      });
    });

    it('maps step-2 PENDING approval to PENDING_MANAGER', async () => {
      approvalEngine.act.mockResolvedValue({ status: ApprovalStatus.PENDING, currentStep: 2 });
      prisma.fuelRequest.update.mockResolvedValue({ status: FuelRequestStatus.PENDING_MANAGER });

      await service.act('company-A', 'fr-1', 'supervisor-1', ApprovalActionType.APPROVE);

      expect(prisma.fuelRequest.update).toHaveBeenCalledWith({
        where: { id: 'fr-1' },
        data: { status: FuelRequestStatus.PENDING_MANAGER },
      });
    });

    it('maps a fully APPROVED approval to FuelRequestStatus.APPROVED', async () => {
      approvalEngine.act.mockResolvedValue({ status: ApprovalStatus.APPROVED, currentStep: 2 });
      prisma.fuelRequest.update.mockResolvedValue({ status: FuelRequestStatus.APPROVED });

      await service.act('company-A', 'fr-1', 'manager-1', ApprovalActionType.APPROVE);

      expect(prisma.fuelRequest.update).toHaveBeenCalledWith({
        where: { id: 'fr-1' },
        data: { status: FuelRequestStatus.APPROVED },
      });
    });

    it('maps REJECTED approval to FuelRequestStatus.REJECTED', async () => {
      approvalEngine.act.mockResolvedValue({ status: ApprovalStatus.REJECTED, currentStep: 1 });
      prisma.fuelRequest.update.mockResolvedValue({ status: FuelRequestStatus.REJECTED });

      await service.act('company-A', 'fr-1', 'supervisor-1', ApprovalActionType.REJECT);

      expect(prisma.fuelRequest.update).toHaveBeenCalledWith({
        where: { id: 'fr-1' },
        data: { status: FuelRequestStatus.REJECTED },
      });
    });
  });
});
