'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import type { Company } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

/**
 * Legacy per-company subscription overview (predates the Billing
 * Engine) — kept as-is since it still reads real data from the older
 * `Subscription` model, which is intentionally NOT wired to the new
 * Billing Engine's `CompanySubscription` yet (see delivery notes: the
 * two are deliberately left unconnected to avoid destabilizing the
 * working MVP). For actual plan/feature/coupon management, see
 * /super-admin/plans and /super-admin/coupons, which are backed by the
 * real Billing Engine.
 */
export default function SubscriptionPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companiesApi
      .listAll()
      .then((res) => setCompanies(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب بيانات الاشتراكات'));
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">اشتراكات الشركات (نظرة قديمة)</h1>
      <p className="mb-4 text-sm text-slate-500">
        هذا الجدول يعرض بيانات النموذج القديم للاشتراكات. لإدارة الخطط والحدود والكوبونات الفعلية، استخدم صفحتَي
        &quot;الخطط والميزات&quot; و&quot;الكوبونات&quot;. لعرض اشتراك شركة مُحدَّدة بمحرك الفوترة الجديد، افتح لوحة تلك الشركة.
      </p>

      {error && <ErrorBanner message={error} />}
      {!error && !companies && <Loading />}

      {companies && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-right">
              <tr>
                <th className="px-4 py-2">الشركة</th>
                <th className="px-4 py-2">الخطة</th>
                <th className="px-4 py-2">الحالة</th>
                <th className="px-4 py-2">الحد الأقصى للمقاعد</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.subscription?.plan ?? '—'}</td>
                  <td className="px-4 py-2">{c.subscription?.status ?? '—'}</td>
                  <td className="px-4 py-2">{c.subscription?.seatsLimit ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
