import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, ModuleCode, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ModulesCatalogService } from './modules-catalog.service';
import { addOnPriceFor, isModuleIncludedInPlan, SEAT_PRICE_SAR } from './entitlement-pricing.data';

export interface EntitlementChange {
  moduleCode: ModuleCode;
  action: 'activate' | 'deactivate';
}

export interface EntitlementImpact {
  moduleCode: ModuleCode;
  action: 'activate' | 'deactivate';
  /** null when deactivating, or when the module is already included in
   * the plan at no extra charge. */
  monthlyPriceImpact: number | null;
  includedInPlan: boolean;
}

/**
 * Sprint 4 — bridges the Sprint 1 Module Marketplace (CompanyModule
 * activation) to real financial consequences, matching the design
 * spec's core rule: "الصلاحيات والخدمات مربوطة بسياسة الاشتراك — أي
 * تفعيل وحدة فوق طبقة الخطة يُحتسب ماليًا فورًا... مع تسجيل في التدقيق."
 *
 * Deliberately does NOT create real CompanyAddOn/Invoice rows yet — that
 * billing-engine machinery expects seeded AddOn/BillingPlan data that
 * doesn't exist in this database (see entitlement-pricing.data.ts's own
 * note). The financial impact is computed and audit-logged honestly;
 * wiring it into an actual invoice line item is a natural next step
 * once that data exists, without changing this service's own contract.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private prisma: PrismaService,
    private modulesCatalog: ModulesCatalogService,
  ) {}

  /** Computes financial impact WITHOUT saving anything — powers the
   * design's `co_entitle` sticky changes panel, which must update live
   * as the admin toggles modules before committing. */
  async previewChanges(companyId: string, changes: EntitlementChange[]): Promise<EntitlementImpact[]> {
    const subscription = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('No subscription found for this company');

    return changes.map((change) => {
      const included = isModuleIncludedInPlan(subscription.plan, change.moduleCode);
      const monthlyPriceImpact =
        change.action === 'activate' && !included ? addOnPriceFor(subscription.plan) : null;
      return { moduleCode: change.moduleCode, action: change.action, monthlyPriceImpact, includedInPlan: included };
    });
  }

  /** Saves the changes: activates/deactivates each module (via the
   * existing Sprint 1 service, so ModuleGuard sees the change
   * immediately) and writes ONE audit log entry per change with the
   * financial impact in its metadata — matches "كل تعديل يُسجَّل في
   * التدقيق" exactly. */
  async applyChanges(companyId: string, changes: EntitlementChange[], actorId: string) {
    const impacts = await this.previewChanges(companyId, changes);

    for (const impact of impacts) {
      if (impact.action === 'activate') {
        await this.modulesCatalog.activate(companyId, impact.moduleCode, actorId);
      } else {
        await this.modulesCatalog.deactivate(companyId, impact.moduleCode).catch(() => {
          // Deactivating a module that was never active is a no-op, not
          // an error, from this endpoint's point of view — the admin's
          // intent ("this module should be off") is already satisfied.
        });
      }

      await this.prisma.auditLog.create({
        data: {
          companyId,
          actorId,
          action: AuditAction.UPDATE,
          entityType: 'CompanyModule',
          entityId: impact.moduleCode,
          metadata: {
            action: impact.action,
            monthlyPriceImpactSar: impact.monthlyPriceImpact,
            includedInPlan: impact.includedInPlan,
          },
        },
      });
    }

    return impacts;
  }

  /** Full entitlement summary for the `co_entitle` screen: plan, seat
   * price, and current per-module included/add-on status. */
  async getEntitlementSummary(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { companyId } });
    if (!subscription) throw new NotFoundException('No subscription found for this company');

    const companyModules = await this.modulesCatalog.getCompanyModules(companyId);
    const seatPrice = SEAT_PRICE_SAR[subscription.plan as SubscriptionPlan];
    const activeModules = companyModules.filter((m) => m.isActive);
    const paidAddOnMonthlyCost = activeModules
      .filter((m) => !isModuleIncludedInPlan(subscription.plan, m.code))
      .reduce((sum) => sum + addOnPriceFor(subscription.plan), 0);

    return {
      plan: subscription.plan,
      seatsLimit: subscription.seatsLimit,
      seatPriceSar: seatPrice,
      monthlySeatCost: seatPrice * subscription.seatsLimit,
      paidAddOnMonthlyCost,
      monthlyTotal: seatPrice * subscription.seatsLimit + paidAddOnMonthlyCost,
      modules: companyModules.map((m) => ({
        ...m,
        includedInPlan: isModuleIncludedInPlan(subscription.plan, m.code),
      })),
    };
  }
}
