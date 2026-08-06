'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import type { Company } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function SubscriptionV2Page() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companiesApi
      .listAll()
      .then((res) => setCompanies(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات الاشتراكات'));
  }, []);

  return (
    <div className="flex flex-col gap-[14px]">
      <div>
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">اشتراكات الشركات (نظرة قديمة)</h1>
        <p className="mt-1 text-sm text-ds-textSecondary">
          هذا الجدول يعرض بيانات النموذج القديم للاشتراكات. لإدارة الخطط والحدود والكوبونات الفعلية، استخدم صفحتَي
          &quot;الخطط والميزات&quot; و&quot;الكوبونات&quot;. لعرض اشتراك شركة مُحدَّدة بمحرك الفوترة الجديد، افتح لوحة تلك الشركة.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {!error && !companies && <Loading />}

      {companies && (
        <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
          <div
            className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
            style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}
          >
            <span>الشركة</span>
            <span>الخطة</span>
            <span>الحالة</span>
            <span>الحد الأقصى للمقاعد</span>
          </div>
          {companies.map((c) => (
            <div key={c.id} className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm last:border-0" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}>
              <span className="font-medium text-ds-text">{c.name}</span>
              <span className="text-ds-textSecondary">{c.subscription?.plan ?? '—'}</span>
              <span className="text-ds-textSecondary">{c.subscription?.status ?? '—'}</span>
              <span className="num text-ds-textSecondary">{c.subscription?.seatsLimit ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
