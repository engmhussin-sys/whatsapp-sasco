import { Test } from '@nestjs/testing';
import { ReportsService } from '../../../src/modules/reports/reports.service';
import { PrismaService } from '../../../src/common/prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn() },
      team: { count: jest.fn() },
      station: { count: jest.fn() },
      approval: { count: jest.fn() },
      fuelRequest: { count: jest.fn() },
      task: { groupBy: jest.fn() },
      message: { count: jest.fn() },
      companySubscription: { findUnique: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
      invoice: { groupBy: jest.fn(), findMany: jest.fn() },
      tokenWallet: { findUnique: jest.fn() },
      translationAuditLog: { groupBy: jest.fn(), aggregate: jest.fn() },
      company: { count: jest.fn() },
      billingPlan: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  describe('companyOverview()', () => {
    it('aggregates counts and reshapes task groupBy results into a status->count map', async () => {
      prisma.user.count.mockResolvedValueOnce(50).mockResolvedValueOnce(42);
      prisma.team.count.mockResolvedValue(6);
      prisma.station.count.mockResolvedValue(3);
      prisma.approval.count.mockResolvedValue(4);
      prisma.fuelRequest.count.mockResolvedValue(2);
      prisma.task.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { _all: 30 } },
        { status: 'ASSIGNED', _count: { _all: 8 } },
      ]);
      prisma.message.count.mockResolvedValue(1200);

      const result = await service.companyOverview('company-A');

      expect(result.users).toEqual({ total: 50, active: 42 });
      expect(result.tasksByStatus).toEqual({ COMPLETED: 30, ASSIGNED: 8 });
      expect(result.messagesLast30Days).toBe(1200);
    });
  });

  describe('billingOverview()', () => {
    it('returns null subscription info gracefully when the company has none yet', async () => {
      prisma.companySubscription.findUnique.mockResolvedValue(null);
      prisma.invoice.groupBy.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.tokenWallet.findUnique.mockResolvedValue(null);

      const result = await service.billingOverview('company-A');

      expect(result.subscription).toBeNull();
      expect(result.tokenWalletBalance).toBe(0);
    });

    it('reshapes invoice totals by status and converts Decimal-like sums to numbers', async () => {
      prisma.companySubscription.findUnique.mockResolvedValue({
        plan: { name: 'Professional', code: 'pro', billingModel: 'HYBRID' },
        isActive: true,
        currentPeriodStart: new Date('2026-01-01'),
        currentPeriodEnd: new Date('2026-02-01'),
        cancelledAt: null,
      });
      prisma.invoice.groupBy.mockResolvedValue([
        { status: 'PAID', _sum: { total: 1500 }, _count: { _all: 3 } },
        { status: 'DRAFT', _sum: { total: 500 }, _count: { _all: 1 } },
      ]);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.tokenWallet.findUnique.mockResolvedValue({ balanceTokens: 250 });

      const result = await service.billingOverview('company-A');

      expect(result.invoiceTotalsByStatus).toEqual({
        PAID: { count: 3, total: 1500 },
        DRAFT: { count: 1, total: 500 },
      });
      expect(result.tokenWalletBalance).toBe(250);
      expect(result.subscription?.planName).toBe('Professional');
    });
  });

  describe('translationOverview()', () => {
    it('computes cacheHitRate correctly — CACHE+DICTIONARY+MEMORY count as cache hits, PROVIDER does not', async () => {
      prisma.translationAuditLog.groupBy
        .mockResolvedValueOnce([
          { resolutionSource: 'CACHE', _count: { _all: 60 } },
          { resolutionSource: 'DICTIONARY', _count: { _all: 10 } },
          { resolutionSource: 'MEMORY', _count: { _all: 10 } },
          { resolutionSource: 'PROVIDER', _count: { _all: 20 } },
        ])
        .mockResolvedValueOnce([{ providerType: 'OPENAI', _count: { _all: 20 } }]);
      prisma.translationAuditLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: 5000, costEstimate: 1.25 } });

      const result = await service.translationOverview('company-A');

      expect(result.totalCalls).toBe(100);
      expect(result.cacheHitRate).toBe(80); // (60+10+10)/100 = 80%
      expect(result.totalTokensUsed).toBe(5000);
      expect(result.totalCostEstimate).toBe(1.25);
    });

    it('returns 0% cache hit rate (not NaN/division-by-zero) when there are no calls at all', async () => {
      prisma.translationAuditLog.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.translationAuditLog.aggregate.mockResolvedValue({ _sum: { tokensUsed: null, costEstimate: null } });

      const result = await service.translationOverview('company-A');

      expect(result.totalCalls).toBe(0);
      expect(result.cacheHitRate).toBe(0);
      expect(result.totalTokensUsed).toBe(0);
    });
  });

  describe('platformOverview()', () => {
    it('resolves plan names for the companiesByPlan breakdown', async () => {
      prisma.company.count.mockResolvedValue(12);
      prisma.companySubscription.count.mockResolvedValue(10);
      prisma.user.count.mockResolvedValue(340);
      prisma.invoice.groupBy.mockResolvedValue([{ status: 'PAID', _sum: { total: 45000 } }]);
      prisma.companySubscription.groupBy.mockResolvedValue([
        { planId: 'plan-1', _count: { _all: 7 } },
        { planId: 'plan-2', _count: { _all: 3 } },
      ]);
      prisma.billingPlan.findMany.mockResolvedValue([
        { id: 'plan-1', name: 'Professional' },
        { id: 'plan-2', name: 'Enterprise' },
      ]);

      const result = await service.platformOverview();

      expect(result.totalPaidRevenue).toBe(45000);
      expect(result.companiesByPlan).toEqual([
        { planId: 'plan-1', planName: 'Professional', companyCount: 7 },
        { planId: 'plan-2', planName: 'Enterprise', companyCount: 3 },
      ]);
    });
  });
});
