'use client';

import { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api/companies';
import { ApiError } from '@/lib/api-client';
import type { PlatformStats } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    companiesApi
      .platformStats()
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الإحصائيات'));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">إحصائيات المنصة</h1>
      {error && <ErrorBanner message={error} />}
      {!error && !stats && <Loading />}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="عدد الشركات" value={stats.companyCount} />
          <StatCard label="عدد المستخدمين" value={stats.userCount} />
          <StatCard label="اشتراكات نشطة" value={stats.activeSubscriptions} />
          <StatCard label="إجمالي الرسائل" value={stats.messageCount} />
        </div>
      )}
    </div>
  );
}
