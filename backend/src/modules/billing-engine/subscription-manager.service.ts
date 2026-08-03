import { Injectable, NotFoundException } from '@nestjs/common';
import { WebhookEventType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenWalletService } from './token-wallet.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

function addPeriod(date: Date, months = 1): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * SUBSCRIPTION MANAGER — the lifecycle around CompanySubscription
 * (subscribe, renew, cancel, change plan). Deliberately thin: it
 * orchestrates BillingPlan + TokenWallet, it does not itself decide
 * pricing or invoice contents (that's InvoiceEngineService's job) —
 * single-responsibility split, each piece independently testable.
 */
@Injectable()
export class SubscriptionManagerService {
  constructor(
    private prisma: PrismaService,
    private tokenWallet: TokenWalletService,
    private webhooks: WebhookDispatcherService,
  ) {}

  async subscribe(companyId: string, planCode: string, periodMonths = 1) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.isActive) throw new NotFoundException(`Billing plan "${planCode}" not found or inactive`);

    const now = new Date();
    const subscription = await this.prisma.companySubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId: plan.id,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: addPeriod(now, periodMonths),
        isActive: true,
      },
      update: {
        planId: plan.id,
        currentPeriodStart: now,
        currentPeriodEnd: addPeriod(now, periodMonths),
        isActive: true,
        cancelledAt: null,
      },
    });

    // Ensures every subscribed company has a wallet ready to receive
    // token top-ups / AI-usage debits from day one, even before any
    // translation/OCR/etc call happens.
    await this.tokenWallet.getOrCreateWallet(companyId);

    return subscription;
  }

  async renew(companyId: string, periodMonths = 1) {
    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('Company has no subscription to renew');

    const updated = await this.prisma.companySubscription.update({
      where: { companyId },
      data: {
        currentPeriodStart: subscription.currentPeriodEnd,
        currentPeriodEnd: addPeriod(subscription.currentPeriodEnd, periodMonths),
        isActive: true,
      },
    });

    await this.webhooks.dispatch(companyId, WebhookEventType.SUBSCRIPTION_RENEWED, {
      subscriptionId: updated.id,
      newPeriodStart: updated.currentPeriodStart,
      newPeriodEnd: updated.currentPeriodEnd,
    });

    return updated;
  }

  async cancel(companyId: string) {
    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('Company has no subscription to cancel');

    return this.prisma.companySubscription.update({
      where: { companyId },
      data: { isActive: false, cancelledAt: new Date() },
    });
  }

  async changePlan(companyId: string, newPlanCode: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { code: newPlanCode } });
    if (!plan || !plan.isActive) throw new NotFoundException(`Billing plan "${newPlanCode}" not found or inactive`);

    const subscription = await this.prisma.companySubscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('Company has no subscription to change');

    return this.prisma.companySubscription.update({ where: { companyId }, data: { planId: plan.id } });
  }

  getSubscription(companyId: string) {
    return this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: { plan: { include: { featureLimits: { include: { feature: true } } } }, addOns: { include: { addOn: true } } },
    });
  }
}
