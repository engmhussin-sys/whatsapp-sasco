'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { CompanyDashboardStats } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function CompanyAdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    companiesApi
      .dashboard(user.companyId)
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب إحصائيات الشركة'));
  }, [user]);

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">لوحة تحكم الشركة</h1>
      {error && <ErrorBanner message={error} />}
      {!error && !stats && <Loading />}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="إجمالي المستخدمين" value={stats.totalUsers} />
            <StatCard label="المستخدمون النشطون" value={stats.activeUsers} />
            <StatCard label="عدد الفرق" value={stats.totalTeams} />
            <StatCard label="عدد المحادثات" value={stats.totalConversations} />
          </div>

          <div className="card mt-6">
            <p className="mb-2 text-sm font-medium text-slate-700">اللغات المدعومة</p>
            {stats.supportedLanguages.length === 0 ? (
              <p className="text-sm text-slate-400">لم تُفعّل أي لغة بعد</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.supportedLanguages.map((lang) => (
                  <span key={lang.code} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                    {lang.nativeName} ({lang.code})
                  </span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
