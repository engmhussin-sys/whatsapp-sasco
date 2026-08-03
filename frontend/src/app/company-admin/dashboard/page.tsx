'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { companiesApi } from '@/lib/api/companies';
import { reportsApi } from '@/lib/api/reports';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { CompanyDashboardStats, CompanyOverviewReport, BillingOverviewReport, TranslationOverviewReport } from '@/lib/types';
import { StatCard } from '@/components/StatCard';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const TASK_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ASSIGNED: 'مُسنَدة',
  IN_PROGRESS: 'قيد التنفيذ',
  SUBMITTED: 'مُرسَلة',
  APPROVED: 'مُعتمَدة',
  REJECTED: 'مرفوضة',
  RETURNED: 'مُعادة',
  COMPLETED: 'مكتملة',
  CANCELED: 'ملغاة',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  ASSIGNED: '#60a5fa',
  IN_PROGRESS: '#2563eb',
  SUBMITTED: '#a78bfa',
  APPROVED: '#34d399',
  REJECTED: '#f87171',
  RETURNED: '#fbbf24',
  COMPLETED: '#059669',
  CANCELED: '#cbd5e1',
};

export default function CompanyAdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewReport | null>(null);
  const [billing, setBilling] = useState<BillingOverviewReport | null>(null);
  const [translation, setTranslation] = useState<TranslationOverviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.companyId) return;
    Promise.all([
      companiesApi.dashboard(user.companyId),
      reportsApi.companyOverview(user.companyId),
      reportsApi.billingOverview(user.companyId),
      reportsApi.translationOverview(user.companyId),
    ])
      .then(([s, o, b, t]) => {
        setStats(s);
        setOverview(o);
        setBilling(b);
        setTranslation(t);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب إحصائيات الشركة'));
  }, [user]);

  const taskChartData = overview
    ? Object.entries(overview.tasksByStatus).map(([status, count]) => ({
        name: TASK_STATUS_LABELS[status] ?? status,
        value: count,
        color: TASK_STATUS_COLORS[status] ?? '#94a3b8',
      }))
    : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-bold">لوحة تحكم الشركة</h1>
        <Link href="/company-admin/billing" className="text-sm font-medium text-brand-600 hover:underline">
          إدارة الاشتراك والفوترة ←
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}
      {!error && !stats && <Loading />}

      {stats && overview && (
        <>
          {/* Row 1 — headline numbers */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="إجمالي المستخدمين" value={stats.totalUsers} hint={`${overview.users.active} نشط الآن`} />
            <StatCard label="عدد الفرق" value={overview.teams} />
            <StatCard label="عدد المحطات" value={overview.stations} />
            <StatCard label="رسائل آخر 30 يومًا" value={overview.messagesLast30Days} accent="green" />
          </div>

          {/* Row 2 — things needing attention */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="موافقات معلَّقة"
              value={overview.approvals.pending}
              accent={overview.approvals.pending > 0 ? 'amber' : 'green'}
              hint={overview.approvals.pending > 0 ? 'بحاجة لمراجعتك' : 'لا شيء معلَّق'}
            />
            <StatCard
              label="طلبات وقود معلَّقة"
              value={overview.fuelRequests.pending}
              accent={overview.fuelRequests.pending > 0 ? 'amber' : 'green'}
            />
            {billing?.subscription && (
              <div className="card">
                <p className="text-sm text-slate-500">الخطة الحالية</p>
                <p className="mt-1 text-lg font-bold text-brand-700">{billing.subscription.planName}</p>
                <p className="mt-1 text-xs text-slate-400">
                  تنتهي: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('ar')}
                </p>
              </div>
            )}
            {translation && (
              <div className="card">
                <p className="text-sm text-slate-500">نسبة إصابة ذاكرة الترجمة</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{translation.cacheHitRate}%</p>
                <p className="mt-1 text-xs text-slate-400">{translation.totalCalls} طلب ترجمة آخر 30 يومًا</p>
              </div>
            )}
          </div>

          {/* Row 3 — tasks breakdown chart */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="card">
              <p className="mb-3 text-sm font-semibold text-slate-700">توزيع المهام حسب الحالة</p>
              {taskChartData.length === 0 ? (
                <p className="text-sm text-slate-400">لا توجد مهام بعد</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={taskChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {taskChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
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

              {translation && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-sm font-medium text-slate-700">مصادر الترجمة (آخر 30 يومًا)</p>
                  <div className="space-y-1.5">
                    {Object.entries(translation.byResolutionSource).map(([source, count]) => (
                      <div key={source} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{sourceLabel(source)}</span>
                        <span className="font-semibold text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    SAME_LANGUAGE: 'نفس اللغة (بلا ترجمة)',
    CACHE: 'ذاكرة مؤقتة (Cache)',
    DICTIONARY: 'قاموس الشركة',
    MEMORY: 'ذاكرة الترجمة',
    PROVIDER: 'مزوّد الذكاء الاصطناعي',
  };
  return labels[source] ?? source;
}
