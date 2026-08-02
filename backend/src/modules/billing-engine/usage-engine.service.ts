import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * USAGE ENGINE — one generic mechanism behind every metered thing the
 * spec lists (Messages, Storage, Voice Minutes, OCR Images, Translations,
 * AI Tokens, API Calls, File Uploads): each is just a BillingFeature code
 * passed to recordUsage(). No per-feature-type code paths exist or are
 * needed — that's the point of a generic Usage Engine rather than
 * bespoke counters per feature.
 */
@Injectable()
export class UsageEngineService {
  constructor(private prisma: PrismaService) {}

  async recordUsage(companyId: string, featureCode: string, amount: number): Promise<void> {
    const feature = await this.prisma.billingFeature.findUnique({ where: { code: featureCode } });
    if (!feature) throw new NotFoundException(`Unknown billing feature code: ${featureCode}`);

    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('Company has no active subscription to meter usage against');

    await this.prisma.usageCounter.upsert({
      where: {
        companyId_featureId_periodStart_periodEnd: {
          companyId,
          featureId: feature.id,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        },
      },
      create: {
        companyId,
        subscriptionId: subscription.id,
        featureId: feature.id,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        usedAmount: amount,
      },
      update: { usedAmount: { increment: amount } },
    });
  }

  async getCurrentUsage(companyId: string, featureCode: string): Promise<number> {
    const feature = await this.prisma.billingFeature.findUnique({ where: { code: featureCode } });
    if (!feature) throw new NotFoundException(`Unknown billing feature code: ${featureCode}`);

    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) return 0;

    const usage = await this.prisma.usageCounter.findUnique({
      where: {
        companyId_featureId_periodStart_periodEnd: {
          companyId,
          featureId: feature.id,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        },
      },
    });
    return usage ? Number(usage.usedAmount) : 0;
  }

  async getUsageSummary(companyId: string) {
    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) return [];

    return this.prisma.usageCounter.findMany({
      where: { companyId, periodStart: subscription.currentPeriodStart, periodEnd: subscription.currentPeriodEnd },
      include: { feature: true },
    });
  }
}
