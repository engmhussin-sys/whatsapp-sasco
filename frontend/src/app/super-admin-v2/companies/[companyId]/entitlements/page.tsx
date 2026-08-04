'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { companiesApi } from '@/lib/api/companies';
import { modulesApi, EntitlementSummary, EntitlementChange, EntitlementImpact } from '@/lib/api/modules';
import type { Company } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function EntitlementsPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, EntitlementChange>>(new Map());
  const [previewImpacts, setPreviewImpacts] = useState<EntitlementImpact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  function load() {
    Promise.all([companiesApi.get(companyId), modulesApi.getEntitlementSummary(companyId)])
      .then(([c, s]) => {
        setCompany(c);
        setSummary(s);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل بيانات الاستحقاقات'));
  }

  useEffect(load, [companyId]);

  // Re-preview whenever pending changes shift — this IS the design's
  // sticky panel "أثر التعديلات" behavior: financial impact recalculates
  // live, before anything is saved.
  useEffect(() => {
    if (pendingChanges.size === 0) {
      setPreviewImpacts([]);
      return;
    }
    modulesApi
      .previewEntitlementChanges(companyId, Array.from(pendingChanges.values()))
      .then(setPreviewImpacts)
      .catch(() => {});
  }, [pendingChanges, companyId]);

  function toggleModule(moduleCode: string, currentlyActive: boolean) {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const key = moduleCode;
      if (next.has(key)) {
        next.delete(key); // toggled back to original state — no longer "pending"
      } else {
        next.set(key, { moduleCode, action: currentlyActive ? 'deactivate' : 'activate' });
      }
      return next;
    });
  }

  async function commitChanges() {
    setApplying(true);
    setError(null);
    try {
      await modulesApi.applyEntitlementChanges(companyId, Array.from(pendingChanges.values()));
      setPendingChanges(new Map());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ التعديلات');
    } finally {
      setApplying(false);
    }
  }

  if (error && !summary) return <ErrorBanner message={error} />;
  if (!company || !summary) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الصلاحيات والخدمات — {company.name}</h1>
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-4 gap-[14px]">
        <SummaryCard label="الشركة" value={company.name} />
        <SummaryCard label="الخطة والمقاعد" value={`${summary.plan} · ${summary.seatsLimit}`} />
        <SummaryCard label="التكلفة الشهرية الحالية" value={`${summary.monthlyTotal.toLocaleString('en')} ر.س`} num />
        <SummaryCard
          label="أثر التعديلات المُعلَّقة"
          value={
            previewImpacts.reduce((s, i) => s + (i.monthlyPriceImpact ?? 0) * (i.action === 'activate' ? 1 : -1), 0) >= 0
              ? `+${previewImpacts.reduce((s, i) => s + (i.monthlyPriceImpact ?? 0), 0).toLocaleString('en')} ر.س`
              : '0 ر.س'
          }
          num
          highlight={pendingChanges.size > 0}
        />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-[14px]">
        {/* ---- Modules grid ---- */}
        <div className="grid grid-cols-2 gap-2.5">
          {summary.modules
            .filter((m) => !m.isComingSoon)
            .map((m) => {
              const pending = pendingChanges.get(m.code);
              const effectiveActive = pending ? pending.action === 'activate' : m.isActive;
              return (
                <div
                  key={m.code}
                  className={`rounded-dsCard border p-4 transition ${
                    effectiveActive ? 'border-ds-primaryLightBorder bg-ds-surface' : 'border-ds-cardBorder bg-ds-surfaceLight'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ds-text">{m.nameAr}</p>
                      <p className="mt-0.5 text-xs text-ds-textMuted">{m.descriptionAr}</p>
                    </div>
                    <button
                      onClick={() => toggleModule(m.code, m.isActive)}
                      className={`relative h-6 w-[42px] shrink-0 rounded-dsPill transition ${
                        effectiveActive ? 'bg-ds-primary' : 'bg-ds-trackBg'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          effectiveActive ? '-translate-x-0.5' : '-translate-x-[21px]'
                        }`}
                      />
                    </button>
                  </div>
                  <span
                    className={`mt-2 inline-block rounded-dsPill px-2 py-0.5 text-[11px] ${
                      m.includedInPlan ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-warningBg text-ds-warningText'
                    }`}
                  >
                    {m.includedInPlan ? 'مشمولة في الخطة' : `إضافة مدفوعة`}
                  </span>
                  {pending && (
                    <p className="num mt-1 text-[11px] text-ds-primary">
                      {pending.action === 'activate' ? 'سيُفعَّل عند الحفظ' : 'سيُعطَّل عند الحفظ'}
                    </p>
                  )}
                </div>
              );
            })}
        </div>

        {/* ---- Sticky changes panel ---- */}
        <div className="sticky top-[84px] h-fit rounded-dsCard bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo p-5 text-ds-onDark shadow-dsDarkCard">
          <h2 className="mb-3 text-sm font-semibold">التعديلات المُعلَّقة</h2>
          {pendingChanges.size === 0 ? (
            <p className="text-xs text-ds-onDarkSecondary">لا توجد تعديلات غير محفوظة</p>
          ) : (
            <div className="flex flex-col gap-2">
              {previewImpacts.map((impact) => (
                <div key={impact.moduleCode} className="rounded-dsCardInner bg-white/5 p-2.5 text-xs">
                  <p className="font-medium">
                    {impact.action === 'activate' ? 'تفعيل' : 'تعطيل'} {impact.moduleCode}
                  </p>
                  {impact.monthlyPriceImpact != null && (
                    <p className="num mt-0.5 text-ds-onDarkSecondary">+{impact.monthlyPriceImpact} ر.س/شهر</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-ds-onDarkMuted">
                    {impact.includedInPlan ? 'داخل الخطة الحالية' : 'يتطلّب تحديث سياسة الاشتراك'}
                  </p>
                </div>
              ))}
              <div className="mt-1 flex gap-2">
                <button
                  onClick={commitChanges}
                  disabled={applying}
                  className="flex-1 rounded-dsField bg-ds-primary py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {applying ? 'جارٍ الحفظ...' : 'حدّث السياسة'}
                </button>
                <button
                  onClick={() => setPendingChanges(new Map())}
                  className="rounded-dsField bg-white/10 px-3 py-2 text-xs text-white"
                >
                  تراجع
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, num, highlight }: { label: string; value: string; num?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`rounded-dsCard border p-4 ${highlight ? 'border-ds-primaryLightBorder bg-ds-primaryLight' : 'border-ds-cardBorder bg-ds-surface'}`}
    >
      <p className="text-xs text-ds-textMuted">{label}</p>
      <p className={`mt-1 text-lg font-semibold text-ds-text ${num ? 'num' : ''}`}>{value}</p>
    </div>
  );
}
