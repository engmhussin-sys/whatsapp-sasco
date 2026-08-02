import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouponService } from './coupon.service';

export interface GenerateInvoiceOptions {
  taxRatePercent?: number; // e.g. 15 for Saudi VAT — passed in, never hardcoded (varies by company/jurisdiction)
  couponCode?: string;
}

/**
 * INVOICE ENGINE — the one place that turns "a company's subscription +
 * its metered usage this period + its active add-ons" into a concrete
 * Invoice with line items. Deliberately reads from FeatureEngine/
 * UsageEngine's own tables directly (UsageCounter, PlanFeatureLimit)
 * rather than recomputing usage itself — single source of truth.
 *
 * Calculation order (matches the spec exactly):
 *   1. Subscription base price (BillingPlan.basePrice)
 *   2. + Overage: for every feature where usage > includedLimit AND the
 *      plan defines an overageUnitPrice, bill the excess
 *   3. + Add-ons: sum of active CompanyAddOn prices
 *   4. − Discount: coupon, if provided and valid
 *   5. + Tax: applied to the post-discount subtotal
 */
@Injectable()
export class InvoiceEngineService {
  constructor(
    private prisma: PrismaService,
    private coupons: CouponService,
  ) {}

  async generateInvoice(companyId: string, options: GenerateInvoiceOptions = {}) {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: {
        plan: { include: { featureLimits: { include: { feature: true } } } },
        addOns: { where: { isActive: true }, include: { addOn: true } },
      },
    });
    if (!subscription) throw new NotFoundException('Company has no active subscription to invoice');

    const lineItems: { description: string; featureCode: string | null; quantity: number; unitPrice: number; amount: number }[] = [];

    // ---- 1. Base subscription price ----
    lineItems.push({
      description: `${subscription.plan.name} — subscription`,
      featureCode: null,
      quantity: 1,
      unitPrice: Number(subscription.plan.basePrice),
      amount: Number(subscription.plan.basePrice),
    });

    // ---- 2. Overage per feature ----
    for (const featureLimit of subscription.plan.featureLimits) {
      if (featureLimit.includedLimit === null || !featureLimit.overageUnitPrice) continue;

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
      const overageQuantity = Math.max(0, used - featureLimit.includedLimit);
      if (overageQuantity > 0) {
        const unitPrice = Number(featureLimit.overageUnitPrice);
        lineItems.push({
          description: `${featureLimit.feature.name} — overage (${overageQuantity} ${featureLimit.feature.unit.toLowerCase()} beyond plan limit)`,
          featureCode: featureLimit.feature.code,
          quantity: overageQuantity,
          unitPrice,
          amount: Math.round(overageQuantity * unitPrice * 100) / 100,
        });
      }
    }

    // ---- 3. Add-ons ----
    for (const companyAddOn of subscription.addOns) {
      lineItems.push({
        description: `Add-on: ${companyAddOn.addOn.name}`,
        featureCode: companyAddOn.addOn.featureId ? null : null,
        quantity: 1,
        unitPrice: Number(companyAddOn.addOn.price),
        amount: Number(companyAddOn.addOn.price),
      });
    }

    const subtotal = Math.round(lineItems.reduce((sum, li) => sum + li.amount, 0) * 100) / 100;

    // ---- 4. Discount ----
    let discountTotal = 0;
    let appliedCouponCode: string | undefined;
    if (options.couponCode) {
      const validation = await this.coupons.validate(options.couponCode, subtotal);
      if (validation.valid) {
        discountTotal = validation.discountAmount ?? 0;
        appliedCouponCode = options.couponCode;
      }
    }

    // ---- 5. Tax ----
    const taxableAmount = subtotal - discountTotal;
    const taxTotal = options.taxRatePercent ? Math.round(taxableAmount * (options.taxRatePercent / 100) * 100) / 100 : 0;

    const total = Math.round((taxableAmount + taxTotal) * 100) / 100;

    const invoiceNumber = `INV-${companyId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        subscriptionId: subscription.id,
        invoiceNumber,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        subtotal,
        discountTotal,
        taxTotal,
        total,
        status: InvoiceStatus.DRAFT,
        lineItems: { create: lineItems },
      },
      include: { lineItems: true },
    });

    if (appliedCouponCode) {
      await this.coupons.redeem(appliedCouponCode, companyId, invoice.id);
    }

    return invoice;
  }

  async issue(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date(), dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    });
  }

  async markPaid(invoiceId: string) {
    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    });
  }

  getInvoice(invoiceId: string) {
    return this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true, payments: true } });
  }

  listForCompany(companyId: string) {
    return this.prisma.invoice.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, include: { lineItems: true } });
  }
}
