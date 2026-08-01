'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import type { Company } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

/**
 * "Subscription Placeholder" as scoped for Phase 1: shows REAL subscription
 * data per company (plan/status/seats) fetched from the live API — there is
 * no mock data here. What's intentionally NOT built yet is billing/payment
 * processing, invoicing, and plan changes with proration, all of which
 * belong to Phase 3 (Enterprise) per the approved roadmap.
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
      <h1 className="mb-2 text-lg font-bold">الاشتراكات</h1>
      <p className="mb-4 text-sm text-slate-500">
        عرض حالة الاشتراك الحالية لكل شركة. إدارة الفوترة والدفع جزء من المرحلة الثالثة (Enterprise) ولم يُبنَ بعد.
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
