'use client';

import { useEffect, useState } from 'react';
import { aiUsageApi, AiUsageSummary } from '@/lib/api/ai-usage';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function AiUsagePage() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiUsageApi.getSummary().then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل بيانات الاستهلاك'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!summary) return <Loading />;

  const maxConsumed = Math.max(...summary.companyBreakdown.map((c) => c.consumedLast30Days), 1);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">استهلاك الذكاء الاصطناعي</h1>

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <p className="text-xs text-ds-textMuted">إجمالي الاستهلاك — آخر 30 يومًا</p>
        <p className="num mt-1 text-3xl font-semibold text-ds-text">{summary.totalConsumedLast30Days.toLocaleString('en')} رمز</p>
      </div>

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr' }}
        >
          <span>الشركة</span>
          <span>الرصيد الحالي</span>
          <span>استهلاك 30 يومًا</span>
          <span></span>
        </div>
        {summary.companyBreakdown.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا يوجد استهلاك مُسجَّل بعد</p>
        ) : (
          summary.companyBreakdown.map((c) => (
            <div
              key={c.companyId}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr' }}
            >
              <span className="font-medium">{c.companyName}</span>
              <span className="num text-xs text-ds-textSecondary">{c.currentBalance.toLocaleString('en')}</span>
              <span className="num text-xs text-ds-textSecondary">{c.consumedLast30Days.toLocaleString('en')}</span>
              <div className="h-2 overflow-hidden rounded-dsPill bg-ds-trackBg">
                <div className="ds-grow h-full rounded-dsPill bg-ds-primary" style={{ width: `${(c.consumedLast30Days / maxConsumed) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
