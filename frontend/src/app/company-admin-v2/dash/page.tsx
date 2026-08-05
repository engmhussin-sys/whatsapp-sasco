'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { reportsApi } from '@/lib/api/reports';
import { tasksApi, approvalsApi } from '@/lib/api/tasks';
import type {
  CompanyDashboardStats,
  CompanyOverviewReport,
  BillingOverviewReport,
  TranslationOverviewReport,
  TaskItem,
  ApprovalItem,
} from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';
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

// Design-system-matched palette (was old Tailwind slate/blue hexes)
const TASK_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#C9CBD9',
  ASSIGNED: '#7C5CFF',
  IN_PROGRESS: '#5B45D6',
  SUBMITTED: '#4ECDC4',
  APPROVED: '#14A87C',
  REJECTED: '#EE4C5B',
  RETURNED: '#E08419',
  COMPLETED: '#22A79E',
  CANCELED: '#EEEFF5',
};

const SOURCE_LABELS: Record<string, string> = {
  SAME_LANGUAGE: 'نفس اللغة (بلا ترجمة)',
  CACHE: 'ذاكرة مؤقتة (Cache)',
  DICTIONARY: 'قاموس الشركة',
  MEMORY: 'ذاكرة الترجمة',
  PROVIDER: 'مزوّد الذكاء الاصطناعي',
};

export default function CompanyAdminDashV2Page() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewReport | null>(null);
  const [billing, setBilling] = useState<BillingOverviewReport | null>(null);
  const [translation, setTranslation] = useState<TranslationOverviewReport | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      companiesApi.dashboard(companyId),
      reportsApi.companyOverview(companyId),
      reportsApi.billingOverview(companyId),
      reportsApi.translationOverview(companyId),
      tasksApi.list(companyId),
      approvalsApi.listMine(companyId),
    ])
      .then(([s, o, b, t, tk, ap]) => {
        setStats(s);
        setOverview(o);
        setBilling(b);
        setTranslation(t);
        setTasks(tk);
        setApprovals(ap);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل لوحة القيادة'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats || !overview || !tasks || !approvals) return <Loading />;

  const completedStatuses = ['SUBMITTED', 'APPROVED', 'COMPLETED'];
  const completionRate = tasks.length > 0 ? Math.round((tasks.filter((t) => completedStatuses.includes(t.status)).length / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && !completedStatuses.includes(t.status));
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  const taskChartData = Object.entries(overview.tasksByStatus).map(([status, count]) => ({
    name: TASK_STATUS_LABELS[status] ?? status,
    value: count,
    color: TASK_STATUS_COLORS[status] ?? '#C9CBD9',
  }));

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">نظرة عامة</h1>

      {/* ---- KPI row: workforce + operations (unchanged from before) ---- */}
      <div className="grid grid-cols-4 gap-[14px]">
        <KpiCard label="إجمالي المستخدمين" value={stats.totalUsers} hint={`${overview.users.active} نشط الآن`} />
        <KpiCard label="عدد الفرق" value={overview.teams} />
        <KpiCard label="عدد المحطات" value={overview.stations} />
        <KpiCard label="رسائل آخر 30 يومًا" value={overview.messagesLast30Days} color="secondary" />
      </div>

      <div className="grid grid-cols-4 gap-[14px]">
        <KpiCard
          label="موافقات معلَّقة"
          value={overview.approvals.pending}
          danger={overview.approvals.pending > 0}
          hint={overview.approvals.pending > 0 ? 'بحاجة لمراجعتك' : 'لا شيء معلَّق'}
        />
        <KpiCard label="طلبات وقود معلَّقة" value={overview.fuelRequests.pending} danger={overview.fuelRequests.pending > 0} />
        <KpiCard label="مهام متأخرة" value={overdueTasks.length} danger={overdueTasks.length > 0} />
        {/* ---- Translation memory metric — ported from the previous
             dashboard design exactly (same source, same field names) ---- */}
        {translation && (
          <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
            <p className="text-xs text-ds-textMuted">نسبة إصابة ذاكرة الترجمة</p>
            <p className="num mt-1 text-2xl font-semibold text-ds-success">{translation.cacheHitRate}%</p>
            <p className="num mt-1 text-[11px] text-ds-textMuted">{translation.totalCalls} طلب ترجمة آخر 30 يومًا</p>
          </div>
        )}
      </div>

      {billing?.subscription && (
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">الخطة الحالية</p>
          <p className="mt-1 text-lg font-semibold text-ds-primaryDarker">{billing.subscription.planName}</p>
          <p className="num mt-1 text-xs text-ds-textMuted">
            تنتهي: {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('en-CA')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-[14px]">
        {/* ---- Tasks-by-status donut — same recharts config, new palette ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ds-text">توزيع المهام حسب الحالة</h2>
          {taskChartData.length === 0 ? (
            <p className="text-sm text-ds-textMuted">لا توجد مهام بعد</p>
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

        {/* ---- Languages + translation sources ---- */}
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <h2 className="mb-2 text-sm font-semibold text-ds-text">اللغات المدعومة</h2>
          {stats.supportedLanguages.length === 0 ? (
            <p className="text-sm text-ds-textMuted">لم تُفعّل أي لغة بعد</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.supportedLanguages.map((lang) => (
                <span key={lang.code} className="rounded-dsPill bg-ds-primaryLight px-3 py-1 text-xs text-ds-primaryDarker">
                  {lang.nativeName} ({lang.code})
                </span>
              ))}
            </div>
          )}

          {translation && (
            <div className="mt-5 border-t border-ds-rowDivider pt-4">
              <h3 className="mb-2 text-sm font-medium text-ds-text">مصادر الترجمة (آخر 30 يومًا)</h3>
              <div className="space-y-1.5">
                {Object.entries(translation.byResolutionSource).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between text-xs">
                    <span className="text-ds-textMuted">{SOURCE_LABELS[source] ?? source}</span>
                    <span className="num font-semibold text-ds-text">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Latest overdue tasks (new-design addition, unchanged) ---- */}
      <div className="rounded-dsCard bg-gradient-to-br from-ds-darkCardFrom to-ds-darkCardTo p-5 text-ds-onDark shadow-dsDarkCard">
        <h2 className="mb-3 text-sm font-semibold">أحدث المهام المتأخرة</h2>
        {overdueTasks.length === 0 ? (
          <p className="text-xs text-ds-onDarkSecondary">لا توجد مهام متأخرة حاليًا</p>
        ) : (
          <div className="flex flex-col gap-2">
            {overdueTasks.slice(0, 4).map((t) => (
              <div key={t.id} className="rounded-dsCardInner bg-white/5 p-2.5 text-xs">
                <p className="font-medium">{t.title}</p>
                {t.dueAt && <p className="num mt-0.5 text-ds-onDarkSecondary">{new Date(t.dueAt).toLocaleDateString('en-CA')}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="num text-xs text-ds-textDisabled">
        نسبة إنجاز المهام: {completionRate}٪ · موافقات بانتظارك: {pendingApprovals.length}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  danger,
  color,
}: {
  label: string;
  value: number;
  hint?: string;
  danger?: boolean;
  color?: 'secondary';
}) {
  return (
    <div className={`rounded-dsCard border p-4 ${danger ? 'border-ds-dangerBorder bg-ds-dangerBg' : 'border-ds-cardBorder bg-ds-surface'}`}>
      <p className="text-xs text-ds-textMuted">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${danger ? 'text-ds-dangerText' : color === 'secondary' ? 'text-ds-secondaryDark' : 'text-ds-text'}`}>
        {value.toLocaleString('en')}
      </p>
      {hint && <p className="mt-1 text-[11px] text-ds-textMuted">{hint}</p>}
    </div>
  );
}
