'use client';

import { Chip, Toggle } from './primitives';
import {
  MODULES,
  TIER_LABEL_AR,
  ADDON_MONTHLY_SAR,
  isIncludedInPlan,
  sar,
  type EntitlementMap,
  type PlanCode,
} from '@/lib/subscription-policy';

/**
 * شبكة الوحدات المشتركة بين معالج الإنشاء وشاشة الصلاحيات ومتجر الوحدات.
 *
 * الوسم هو ما يربط الصلاحية بالاشتراك بصريًا:
 *   أخضر  = مشمولة في الخطة
 *   برتقالي = مُفعَّلة كإضافة مدفوعة فوق الخطة (تُدرَج في السياسة)
 *   رمادي  = تتطلب خطة أعلى
 */
export function ModuleGrid({
  plan,
  modules,
  onToggle,
  columns = 3,
  readOnly = false,
}: {
  plan: PlanCode;
  modules: EntitlementMap;
  onToggle?: (code: string) => void;
  columns?: 2 | 3;
  readOnly?: boolean;
}) {
  return (
    <div className={`grid gap-2.5 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {MODULES.map((m) => {
        const on = !!modules[m.code];
        const included = isIncludedInPlan(m.code, plan);
        return (
          <div
            key={m.code}
            className={`rounded-[15px] border bg-ds-surface p-3.5 transition ${
              on ? (included ? 'border-ds-primaryLightBorder' : 'border-ds-warningBorder') : 'border-ds-cardBorder'
            }`}
          >
            <div className="mb-2.5 flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-sm ${
                  on
                    ? 'bg-gradient-to-br from-ds-primary to-ds-primaryDark text-white'
                    : 'bg-ds-trackBg text-ds-textMuted'
                }`}
                aria-hidden="true"
              >
                ◆
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ds-text">{m.nameAr}</span>
                <span className="block text-[11.5px] text-ds-textMuted">طبقة {TIER_LABEL_AR[m.tier]}</span>
              </span>
              {!readOnly && onToggle && <Toggle on={on} onToggle={() => onToggle(m.code)} label={m.nameAr} />}
            </div>
            <p className="mb-2.5 min-h-[38px] text-[12px] leading-relaxed text-ds-textSecondary">{m.descriptionAr}</p>
            <Chip tone={included ? 'success' : on ? 'warning' : 'neutral'}>
              {included ? (
                'مشمولة في الخطة'
              ) : on ? (
                <>
                  إضافة مدفوعة · <span className="num">{sar(ADDON_MONTHLY_SAR[m.tier])}</span> ر.س/شهر
                </>
              ) : (
                `تتطلب خطة ${TIER_LABEL_AR[m.tier]}`
              )}
            </Chip>
          </div>
        );
      })}
    </div>
  );
}
