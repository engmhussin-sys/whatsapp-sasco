import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FeatureAccessResult {
  allowed: boolean;
  reason?: 'NOT_INCLUDED_IN_PLAN' | 'LIMIT_EXCEEDED' | 'NO_ACTIVE_SUBSCRIPTION';
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null;
}

/**
 * FEATURE ENGINE — the single source of truth for "can this company do
 * X right now", replacing ANY hardcoded `if (company.plan === 'PRO')`
 * check anywhere in the system. Every feature is just a row in
 * BillingFeature (e.g. code: "can_use_translation", "max_users",
 * "monthly_ai_tokens") referenced by code — adding a new feature or
 * changing a plan's limits is a database write, never a code change.
 */
@Injectable()
export class FeatureEngineService {
  constructor(private prisma: PrismaService) {}

  async checkAccess(companyId: string, featureCode: string): Promise<FeatureAccessResult> {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: { include: { featureLimits: { include: { feature: true } } } } },
    });

    if (!subscription || !subscription.isActive) {
      return { allowed: false, reason: 'NO_ACTIVE_SUBSCRIPTION', limit: 0, used: 0, remaining: 0 };
    }

    const featureLimit = subscription.plan.featureLimits.find(
      (fl: { feature: { code: string } }) => fl.feature.code === featureCode,
    );
    if (!featureLimit) {
      return { allowed: false, reason: 'NOT_INCLUDED_IN_PLAN', limit: 0, used: 0, remaining: 0 };
    }

    if (featureLimit.includedLimit === null) {
      return { allowed: true, limit: null, used: 0, remaining: null };
    }

    const usage = await this.prisma.usageCounter.findUnique({
      where: {
        companyId_featureId_periodStart_periodEnd: {
          companyId,
          featureId: featureLimit.featureId,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
        },
      },
    });

    const used = usage ? Number(usage.usedAmount) : 0;
    const limit = featureLimit.includedLimit;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      reason: used >= limit ? 'LIMIT_EXCEEDED' : undefined,
      limit,
      used,
      remaining,
    };
  }

  /** Throws if access isn't allowed — convenience for call sites that want a guard rather than a boolean to branch on. */
  async assertAccess(companyId: string, featureCode: string): Promise<void> {
    const result = await this.checkAccess(companyId, featureCode);
    if (!result.allowed) {
      throw new NotFoundException(`Feature "${featureCode}" is not available: ${result.reason}`);
    }
  }
}
