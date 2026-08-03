'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { reportsApi } from '@/lib/api/reports';
import { ApiError } from '@/lib/api-client';
import type { PlatformStats, PlatformOverviewReport } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [overview, setOverview] = useState<PlatformOverviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([companiesApi.platformStats(), reportsApi.platformOverview()])
      .then(([s, o]) => {
        setStats(s);
        setOverview(o);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الإحصائيات'));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">إحصائيات المنصة</h1>
      {error && <ErrorBanner message={error} />}
      {!error && !stats && <Loading />}
      {stats && overview && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="عدد الشركات" value={stats.companyCount} />
            <StatCard label="عدد المستخدمين" value={stats.userCount} />
            <StatCard label="اشتراكات نشطة" value={overview.activeSubscriptions} accent="green" />
            <StatCard
              label="إجمالي الإيرادات المحصَّلة"
              value={`${overview.totalPaidRevenue.toLocaleString('ar')} ر.س`}
              accent="brand"
            />
          </div>

          <div className="card mt-6">
            <p className="mb-3 text-sm font-semibold text-slate-700">توزيع الشركات حسب الخطة</p>
            {overview.companiesByPlan.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد اشتراكات نشطة بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={overview.companiesByPlan} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="planName" width={100} />
                  <Tooltip />
                  <Bar dataKey="companyCount" fill="#2563eb" radius={[0, 6, 6, 0]} name="عدد الشركات" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
