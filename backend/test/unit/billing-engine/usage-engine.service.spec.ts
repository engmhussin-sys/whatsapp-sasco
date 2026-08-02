import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsageEngineService } from '../../../src/modules/billing-engine/usage-engine.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('UsageEngineService', () => {
  let service: UsageEngineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      billingFeature: { findUnique: jest.fn() },
      companySubscription: { findUnique: jest.fn() },
      usageCounter: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [UsageEngineService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(UsageEngineService);
  });

  it('throws for an unknown feature code rather than silently no-op-ing', async () => {
    prisma.billingFeature.findUnique.mockResolvedValue(null);
    await expect(service.recordUsage('company-A', 'nonexistent_feature', 1)).rejects.toThrow(NotFoundException);
  });

  it('throws when the company has no subscription to meter against', async () => {
    prisma.billingFeature.findUnique.mockResolvedValue({ id: 'f1', code: 'api_calls_monthly' });
    prisma.companySubscription.findUnique.mockResolvedValue(null);
    await expect(service.recordUsage('company-A', 'api_calls_monthly', 1)).rejects.toThrow(NotFoundException);
  });

  it('upserts the usage counter for the CURRENT billing period, incrementing on repeat calls', async () => {
    prisma.billingFeature.findUnique.mockResolvedValue({ id: 'f1', code: 'voice_minutes_monthly' });
    prisma.companySubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
    });

    await service.recordUsage('company-A', 'voice_minutes_monthly', 5);

    expect(prisma.usageCounter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_featureId_periodStart_periodEnd: {
            companyId: 'company-A',
            featureId: 'f1',
            periodStart: new Date('2026-01-01'),
            periodEnd: new Date('2026-02-01'),
          },
        },
        update: { usedAmount: { increment: 5 } },
      }),
    );
  });

  it('getCurrentUsage() returns 0 for a company with no subscription instead of throwing', async () => {
    prisma.billingFeature.findUnique.mockResolvedValue({ id: 'f1', code: 'ocr_pages_monthly' });
    prisma.companySubscription.findUnique.mockResolvedValue(null);

    const usage = await service.getCurrentUsage('company-A', 'ocr_pages_monthly');
    expect(usage).toBe(0);
  });

  it('getCurrentUsage() returns the actual usedAmount when a counter exists', async () => {
    prisma.billingFeature.findUnique.mockResolvedValue({ id: 'f1', code: 'ocr_pages_monthly' });
    prisma.companySubscription.findUnique.mockResolvedValue({
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
    });
    prisma.usageCounter.findUnique.mockResolvedValue({ usedAmount: 42 });

    const usage = await service.getCurrentUsage('company-A', 'ocr_pages_monthly');
    expect(usage).toBe(42);
  });
});
