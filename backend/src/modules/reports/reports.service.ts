import { Injectable } from '@nestjs/common';
import { InvoiceStatus, TranslationResolutionSource } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * REPORTS ENGINE — read-only aggregation layer powering the dashboard.
 * Deliberately has no business logic of its own beyond querying/summing
 * data that the other engines (Billing, Translation, Task, Approval,
 * Fuel Request) already produce — a reporting layer should never be the
 * source of truth for anything, only a view over it.
 */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Company Admin dashboard: operational snapshot for one company. */
  async companyOverview(companyId: string) {
    const [userCount, activeUserCount, teamCount, stationCount, pendingApprovals, pendingFuelRequests, taskStatusCounts, messagesLast30Days] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.user.count({ where: { companyId, isActive: true } }),
        this.prisma.team.count({ where: { companyId } }),
        this.prisma.station.count({ where: { companyId } }),
        this.prisma.approval.count({ where: { companyId, status: 'PENDING' } }),
        this.prisma.fuelRequest.count({ where: { companyId, status: { in: ['PENDING_SUPERVISOR', 'PENDING_MANAGER'] } } }),
        this.prisma.task.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
        this.prisma.message.count({
          where: { conversation: { companyId }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        }),
      ]);

    return {
      users: { total: userCount, active: activeUserCount },
      teams: teamCount,
      stations: stationCount,
      approvals: { pending: pendingApprovals },
      fuelRequests: { pending: pendingFuelRequests },
      tasksByStatus: Object.fromEntries(
        taskStatusCounts.map((row: { status: string; _count: { _all: number } }) => [row.status, row._count._all]),
      ),
      messagesLast30Days,
    };
  }

  /** Billing & Subscription dashboard section for one company. */
  async billingOverview(companyId: string) {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });

    const [invoiceTotals, recentInvoices, wallet] = await Promise.all([
      this.prisma.invoice.groupBy({ by: ['status'], where: { companyId }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.invoice.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 5 }),
      this.prisma.tokenWallet.findUnique({ where: { companyId } }),
    ]);

    return {
      subscription: subscription
        ? {
            planName: subscription.plan.name,
            planCode: subscription.plan.code,
            billingModel: subscription.plan.billingModel,
            isActive: subscription.isActive,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelledAt: subscription.cancelledAt,
          }
        : null,
      invoiceTotalsByStatus: Object.fromEntries(
        invoiceTotals.map((row: { status: string; _sum: { total: unknown }; _count: { _all: number } }) => [
          row.status,
          { count: row._count._all, total: Number(row._sum.total ?? 0) },
        ]),
      ),
      recentInvoices,
      tokenWalletBalance: wallet ? Number(wallet.balanceTokens) : 0,
    };
  }

  /** Translation Engine usage dashboard section for one company. */
  async translationOverview(companyId: string, sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    const [bySource, byProvider, costAndTokens] = await Promise.all([
      this.prisma.translationAuditLog.groupBy({
        by: ['resolutionSource'],
        where: { companyId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.translationAuditLog.groupBy({
        by: ['providerType'],
        where: { companyId, createdAt: { gte: since }, resolutionSource: TranslationResolutionSource.PROVIDER },
        _count: { _all: true },
      }),
      this.prisma.translationAuditLog.aggregate({
        where: { companyId, createdAt: { gte: since } },
        _sum: { tokensUsed: true, costEstimate: true },
      }),
    ]);

    const totalCalls = bySource.reduce((sum: number, row: { _count: { _all: number } }) => sum + row._count._all, 0);
    const cacheHitTypes: string[] = ['CACHE', 'DICTIONARY', 'MEMORY'];
    const cacheHits = bySource
      .filter((row: { resolutionSource: string }) => cacheHitTypes.includes(row.resolutionSource))
      .reduce((sum: number, row: { _count: { _all: number } }) => sum + row._count._all, 0);

    return {
      periodDays: sinceDays,
      totalCalls,
      // The whole point of the Smart Translation Policy is to minimize
      // AI provider calls — this ratio is the single most important
      // number for proving the policy is actually working in production.
      cacheHitRate: totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 1000) / 10 : 0,
      byResolutionSource: Object.fromEntries(
        bySource.map((row: { resolutionSource: string; _count: { _all: number } }) => [row.resolutionSource, row._count._all]),
      ),
      byProvider: Object.fromEntries(
        byProvider
          .filter((row: { providerType: string | null }) => row.providerType !== null)
          .map((row: { providerType: string | null; _count: { _all: number } }) => [row.providerType as string, row._count._all]),
      ),
      totalTokensUsed: costAndTokens._sum.tokensUsed ?? 0,
      totalCostEstimate: Number(costAndTokens._sum.costEstimate ?? 0),
    };
  }

  /** Super Admin platform-wide overview — spans every company. */
  async platformOverview() {
    const [companyCount, activeSubscriptions, userCount, revenueByStatus, companiesByPlan] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.companySubscription.count({ where: { isActive: true } }),
      this.prisma.user.count(),
      this.prisma.invoice.groupBy({ by: ['status'], _sum: { total: true } }),
      this.prisma.companySubscription.groupBy({ by: ['planId'], where: { isActive: true }, _count: { _all: true } }),
    ]);

    const paidRevenue = revenueByStatus.find((r: { status: string }) => r.status === InvoiceStatus.PAID);

    const planNames = await this.prisma.billingPlan.findMany({
      where: { id: { in: companiesByPlan.map((r: { planId: string }) => r.planId) } },
      select: { id: true, name: true },
    });
    const planNameById = new Map(planNames.map((p: { id: string; name: string }) => [p.id, p.name]));

    return {
      companies: companyCount,
      activeSubscriptions,
      totalUsers: userCount,
      totalPaidRevenue: Number(paidRevenue?._sum.total ?? 0),
      companiesByPlan: companiesByPlan.map((row: { planId: string; _count: { _all: number } }) => ({
        planId: row.planId,
        planName: planNameById.get(row.planId) ?? 'Unknown',
        companyCount: row._count._all,
      })),
    };
  }
}
