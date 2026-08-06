/**
 * سياسة الاشتراك — قواعد الاستحقاق والتسعير في مكان واحد.
 *
 * هذا الملف هو المصدر الوحيد للحقيقة في الواجهة، ويجب أن يقابله منطق
 * مماثل في الباكند (NestJS) — الواجهة تحسب للعرض والمعاينة فقط، والقرار
 * النهائي والفاتورة يُصدَران من الخادم.
 *
 * القاعدتان الملزمتان:
 *   entitlement          = (PLAN_RANK[plan] >= TIER_RANK[module.tier]) OR addonPurchased
 *   effectivePermission  = rolePermission AND entitlement
 */

export type PlanCode = 'TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
export type ModuleTier = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
export type ModuleCategory = 'COMM' | 'OPS' | 'ASSETS' | 'PEOPLE' | 'AI';

export const PLAN_RANK: Record<PlanCode, number> = { TRIAL: 0, BASIC: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };
export const TIER_RANK: Record<ModuleTier, number> = { BASIC: 1, PROFESSIONAL: 2, ENTERPRISE: 3 };

export const PLAN_LABEL_AR: Record<PlanCode, string> = {
  TRIAL: 'تجريبية',
  BASIC: 'أساسي',
  PROFESSIONAL: 'نمو',
  ENTERPRISE: 'مؤسسي',
};

export const TIER_LABEL_AR: Record<ModuleTier, string> = {
  BASIC: 'أساسي',
  PROFESSIONAL: 'نمو',
  ENTERPRISE: 'مؤسسي',
};

/** سعر المقعد شهريًا بالريال. TRIAL بلا مقابل. */
export const PLAN_SEAT_PRICE_SAR: Record<PlanCode, number> = {
  TRIAL: 0,
  BASIC: 12,
  PROFESSIONAL: 22,
  ENTERPRISE: 38,
};

/** تكلفة تفعيل وحدة أعلى من طبقة الخطة، شهريًا بالريال. */
export const ADDON_MONTHLY_SAR: Record<ModuleTier, number> = {
  BASIC: 0,
  PROFESSIONAL: 900,
  ENTERPRISE: 1800,
};

export const CATEGORY_LABEL_AR: Record<ModuleCategory | 'ALL', string> = {
  ALL: 'الكل',
  COMM: 'التواصل',
  OPS: 'التشغيل',
  ASSETS: 'الأصول والمخزون',
  PEOPLE: 'الموارد البشرية',
  AI: 'الذكاء والتحليلات',
};

export interface PlatformModule {
  code: string;
  nameAr: string;
  tier: ModuleTier;
  category: ModuleCategory;
  descriptionAr: string;
}

/**
 * كتالوج الوحدات. يجب أن يأتي من `GET /modules` في الإنتاج — هذه القائمة
 * هي القيمة الاحتياطية (fallback) حتى تُنشأ نقطة النهاية، ورموزها
 * (`code`) هي العقد المتفق عليه مع الباكند.
 */
export const MODULES: PlatformModule[] = [
  { code: 'chat', nameAr: 'الدردشة المترجمة', tier: 'BASIC', category: 'COMM', descriptionAr: 'محادثات فردية وجماعية، كل رسالة بلغة مستلمها والأصل محفوظ للتدقيق.' },
  { code: 'voice', nameAr: 'الرسائل الصوتية', tier: 'BASIC', category: 'COMM', descriptionAr: 'تسجيل بضغطة واحدة، وتحويل إلى نص قابل للبحث في التقارير.' },
  { code: 'tasks', nameAr: 'المهام وأوامر العمل', tier: 'BASIC', category: 'OPS', descriptionAr: 'إسناد وجدولة ومتابعة، مع سلاسل موافقات وإثبات تنفيذ.' },
  { code: 'attendance', nameAr: 'الحضور والورديات', tier: 'BASIC', category: 'PEOPLE', descriptionAr: 'تسجيل دخول وخروج، جداول ورديات، وتنبيهات التأخّر.' },
  { code: 'forms', nameAr: 'منشئ النماذج', tier: 'PROFESSIONAL', category: 'OPS', descriptionAr: 'فحوصات وحوادث وطلبات تُبنى دون برمجة وتُنشر فورًا.' },
  { code: 'gps', nameAr: 'التتبّع والمواقع', tier: 'PROFESSIONAL', category: 'OPS', descriptionAr: 'تحقّق جغرافي من الحضور والمهام مع نطاقات مسموحة.' },
  { code: 'maintenance', nameAr: 'الصيانة', tier: 'PROFESSIONAL', category: 'OPS', descriptionAr: 'صيانة وقائية وطلبات إصلاح مرتبطة بالأصول والمواقع.' },
  { code: 'safety', nameAr: 'السلامة والحوادث', tier: 'PROFESSIONAL', category: 'OPS', descriptionAr: 'تبليغ فوري وتحقيق وإجراءات تصحيحية مع مؤشرات امتثال.' },
  { code: 'docs', nameAr: 'المستندات والتوقيع', tier: 'PROFESSIONAL', category: 'OPS', descriptionAr: 'مكتبة مستندات وتوقيع رقمي على النماذج والإقرارات.' },
  { code: 'ticketing', nameAr: 'التذاكر وقاعدة المعرفة', tier: 'PROFESSIONAL', category: 'COMM', descriptionAr: 'طلبات دعم داخلية ومقالات إرشادية بلغات العمال.' },
  { code: 'assets', nameAr: 'إدارة الأصول', tier: 'PROFESSIONAL', category: 'ASSETS', descriptionAr: 'سجل معدّات بأعمار وضمانات وسجل صيانة كامل.' },
  { code: 'training', nameAr: 'التدريب والشهادات', tier: 'ENTERPRISE', category: 'PEOPLE', descriptionAr: 'مسارات تدريب وتنبيهات انتهاء شهادات السلامة.' },
  { code: 'hr', nameAr: 'الموارد البشرية', tier: 'ENTERPRISE', category: 'PEOPLE', descriptionAr: 'ملفات موظفين وإجازات ومزامنة مع أنظمة الرواتب.' },
  { code: 'ai', nameAr: 'مساعد الذكاء', tier: 'ENTERPRISE', category: 'AI', descriptionAr: 'توزيع تلقائي للمهام، تلخيص ورديات، وكشف الشذوذ.' },
  { code: 'fleet', nameAr: 'الأسطول والمركبات', tier: 'ENTERPRISE', category: 'ASSETS', descriptionAr: 'مركبات وسواقة واستهلاك وقود وفحوصات ما قبل الرحلة.' },
  { code: 'inventory', nameAr: 'المخزون', tier: 'ENTERPRISE', category: 'ASSETS', descriptionAr: 'مستودعات وحركة صرف مع باركود وQR من تطبيق العامل.' },
  { code: 'visitors', nameAr: 'إدارة الزوّار', tier: 'ENTERPRISE', category: 'OPS', descriptionAr: 'تصاريح دخول وبطاقات مؤقتة وسجل زيارات قابل للتدقيق.' },
  { code: 'crm', nameAr: 'العملاء والعقود', tier: 'ENTERPRISE', category: 'AI', descriptionAr: 'عقود خدمة ومواقع عملاء مرتبطة بأوامر العمل.' },
];

export const MODULE_BY_CODE: Record<string, PlatformModule> = MODULES.reduce(
  (acc, m) => {
    acc[m.code] = m;
    return acc;
  },
  {} as Record<string, PlatformModule>,
);

/** خريطة الاستحقاق: رمز الوحدة → مُفعَّلة أم لا. */
export type EntitlementMap = Record<string, boolean>;

export function isIncludedInPlan(moduleCode: string, plan: PlanCode): boolean {
  const mod = MODULE_BY_CODE[moduleCode];
  if (!mod) return false;
  return PLAN_RANK[plan] >= TIER_RANK[mod.tier];
}

/** الاستحقاق الفعلي: مشمولة في الخطة أو مُشتراة كإضافة. */
export function isEntitled(moduleCode: string, plan: PlanCode, entitlements: EntitlementMap): boolean {
  return isIncludedInPlan(moduleCode, plan) || entitlements[moduleCode] === true;
}

/**
 * الصلاحية الفعلية = صلاحية الدور AND الاستحقاق.
 * الوحدة غير المستحقّة **مخفية** لكل الأدوار — لا معطّلة.
 */
export function effectivePermission(
  rolePermission: 0 | 1 | 2 | 3,
  moduleCode: string,
  plan: PlanCode,
  entitlements: EntitlementMap,
): 0 | 1 | 2 | 3 {
  return isEntitled(moduleCode, plan, entitlements) ? rolePermission : 0;
}

/**
 * خط الأساس لمستأجر: كل ما تشمله طبقة خطته، زائد إضافاته المُشتراة صراحةً.
 * يُشتقّ لكل مستأجر على حدة — لا خريطة عامة مشتركة.
 */
export function baselineFor(plan: PlanCode, purchasedAddonCodes: string[] = []): EntitlementMap {
  const map: EntitlementMap = {};
  for (const m of MODULES) if (isIncludedInPlan(m.code, plan)) map[m.code] = true;
  for (const code of purchasedAddonCodes) map[code] = true;
  return map;
}

export interface PriceBreakdown {
  seatsTotal: number;
  addonsTotal: number;
  total: number;
  /** الإضافات المحتسَبة: وحدات مفعّلة أعلى من طبقة الخطة. */
  billedAddons: { code: string; nameAr: string; monthly: number }[];
}

export function priceBreakdown(plan: PlanCode, seats: number, entitlements: EntitlementMap): PriceBreakdown {
  const seatsTotal = PLAN_SEAT_PRICE_SAR[plan] * Math.max(0, seats);
  const billedAddons = MODULES.filter((m) => entitlements[m.code] && !isIncludedInPlan(m.code, plan)).map((m) => ({
    code: m.code,
    nameAr: m.nameAr,
    monthly: ADDON_MONTHLY_SAR[m.tier],
  }));
  const addonsTotal = billedAddons.reduce((sum, a) => sum + a.monthly, 0);
  return { seatsTotal, addonsTotal, total: seatsTotal + addonsTotal, billedAddons };
}

export interface EntitlementChange {
  code: string;
  nameAr: string;
  direction: 'ENABLE' | 'DISABLE';
  /** الأثر المالي الشهري بالريال؛ 0 إذا كانت الوحدة داخل الخطة. */
  monthlyDelta: number;
  requiresPolicyUpdate: boolean;
}

/** الفرق بين السياسة المحفوظة والتعديلات غير المحفوظة. */
export function diffEntitlements(baseline: EntitlementMap, draft: EntitlementMap, plan: PlanCode): EntitlementChange[] {
  return MODULES.filter((m) => !!baseline[m.code] !== !!draft[m.code]).map((m) => {
    const enabling = !!draft[m.code];
    const outsidePlan = !isIncludedInPlan(m.code, plan);
    return {
      code: m.code,
      nameAr: m.nameAr,
      direction: enabling ? 'ENABLE' : 'DISABLE',
      monthlyDelta: outsidePlan ? (enabling ? ADDON_MONTHLY_SAR[m.tier] : -ADDON_MONTHLY_SAR[m.tier]) : 0,
      requiresPolicyUpdate: outsidePlan,
    };
  });
}

/** تنسيق مبلغ بالريال بأرقام لاتينية (يُلبَس بصنف `.num` في الواجهة). */
export function sar(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}
