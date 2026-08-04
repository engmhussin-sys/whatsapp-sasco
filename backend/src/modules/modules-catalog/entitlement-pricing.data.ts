import { ModuleCode, SubscriptionPlan } from '@prisma/client';

/**
 * Reference pricing matching the adopted design spec exactly (see
 * design_handoff's "التسعير المرجعي" section): seat price by plan tier,
 * and a flat monthly add-on price for a module NOT included in the
 * company's current plan. This is REFERENCE pricing — the same numbers
 * the design mockup itself specifies — not connected to the separate
 * BillingPlan/AddOn tables (which have no seeded real data yet; see
 * Sprint 4 notes in final-roadmap-16-sprints.md). Swapping this for a
 * fully database-driven pricing table is a natural later step once
 * BillingPlan data actually exists, without changing anything that
 * calls EntitlementsService.
 */
export const SEAT_PRICE_SAR: Record<SubscriptionPlan, number> = {
  TRIAL: 0,
  BASIC: 12,
  PROFESSIONAL: 22, // "نمو" (growth) tier in the design
  ENTERPRISE: 38,
};

/** Which modules are included at NO extra charge for each plan tier —
 * anything NOT listed here requires the add-on charge below if activated. */
export const PLAN_INCLUDED_MODULES: Record<SubscriptionPlan, ModuleCode[]> = {
  TRIAL: [ModuleCode.CHAT, ModuleCode.TASKS, ModuleCode.DIRECTORY],
  BASIC: [ModuleCode.CHAT, ModuleCode.TASKS, ModuleCode.APPROVALS, ModuleCode.DIRECTORY, ModuleCode.SAFETY],
  PROFESSIONAL: [
    ModuleCode.CHAT,
    ModuleCode.TASKS,
    ModuleCode.APPROVALS,
    ModuleCode.SHIFTS,
    ModuleCode.FUEL_REQUESTS,
    ModuleCode.SAFETY,
    ModuleCode.BROADCAST,
    ModuleCode.DIRECTORY,
    ModuleCode.REPORTS,
  ],
  ENTERPRISE: Object.values(ModuleCode), // everything, including roadmap modules once they ship
};

/** Flat monthly add-on price (SAR) for activating a module NOT included
 * in the company's plan — matches the design's own two-tier reference
 * numbers (نمو 900 / مؤسسي 1800) exactly. */
export function addOnPriceFor(plan: SubscriptionPlan): number {
  return plan === SubscriptionPlan.ENTERPRISE ? 1800 : 900;
}

export function isModuleIncludedInPlan(plan: SubscriptionPlan, moduleCode: ModuleCode): boolean {
  return PLAN_INCLUDED_MODULES[plan].includes(moduleCode);
}
