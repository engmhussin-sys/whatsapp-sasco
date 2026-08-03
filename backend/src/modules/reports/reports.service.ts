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

  /**
   * Super Admin EXECUTIVE dashboard — richer than platformOverview()
   * above (which predates the Executive Dashboard module and is left
   * unchanged since the current dashboard page still calls it). This
   * adds MRR/ARR, trial/active/inactive company breakdown, expiring
   * subscriptions, failed payments, month-over-month growth, and a
   * cross-company activity timeline.
   *
   * ⚠️ MRR CALCULATION CAVEAT (documented honestly, not hidden): this
   * sums BillingPlan.basePrice for every active, non-trial subscription.
   * For PER_USER/HYBRID plans this is the FLAT component only — it does
   * NOT add per-seat overage revenue (that only exists per-invoice,
   * after usage is billed, and varies month to month by actual headcount
   * rather than being a stable "recurring" figure the way MRR is meant
   * to represent). This is a reasonable, standard simplification for an
   * MRR figure, but it will under-count true revenue for companies with
   * heavy overage usage — a fully accurate figure would need to average
   * recent invoice totals instead, which is a documented follow-up.
   */
  async executiveOverview() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCompanies,
      activeSubs,
      trialSubs,
      expiringSoon,
      failedPaymentsCount,
      newSubsThisMonth,
      newSubsLastMonth,
      failedPayments30d,
      latestCompanies,
      latestPayments,
      activityTimeline,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.companySubscription.findMany({ where: { isActive: true, isTrial: false }, include: { plan: true } }),
      this.prisma.companySubscription.count({ where: { isActive: true, isTrial: true } }),
      this.prisma.companySubscription.count({ where: { isActive: true, currentPeriodEnd: { gte: now, lte: in7Days } } }),
      this.prisma.paymentTransaction.count({ where: { status: 'FAILED', createdAt: { gte: last30Days } } }),
      this.prisma.companySubscription.count({ where: { createdAt: { gte: startOfThisMonth } } }),
      this.prisma.companySubscription.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } } }),
      this.prisma.paymentTransaction.findMany({
        where: { status: 'FAILED', createdAt: { gte: last30Days } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.company.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, name: true, createdAt: true } }),
      this.prisma.paymentTransaction.findMany({
        where: { status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, companyId: true, amount: true, currency: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          actor: { select: { firstName: true, lastName: true } },
          company: { select: { name: true } },
        },
      }),
    ]);

    const mrr = activeSubs.reduce((sum: number, sub: { plan: { basePrice: unknown } }) => sum + Number(sub.plan.basePrice), 0);
    const activeCompaniesCount = activeSubs.length;
    const inactiveCompaniesCount = Math.max(0, totalCompanies - activeCompaniesCount - trialSubs);
    const growthRate = newSubsLastMonth > 0 ? Math.round(((newSubsThisMonth - newSubsLastMonth) / newSubsLastMonth) * 1000) / 10 : null;

    return {
      revenue: { mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100 },
      companies: {
        total: totalCompanies,
        active: activeCompaniesCount,
        trial: trialSubs,
        inactive: inactiveCompaniesCount,
      },
      expiringSoon,
      failedPayments: { count: failedPaymentsCount, recent: failedPayments30d },
      growth: { thisMonth: newSubsThisMonth, lastMonth: newSubsLastMonth, changePercent: growthRate },
      latestCompanies,
      latestPayments,
      activityTimeline: activityTimeline.map((log: any) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        actorName: log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'النظام',
        companyName: log.company?.name ?? null,
        createdAt: log.createdAt,
      })),
    };
  }
}
