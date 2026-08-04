'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { tasksApi, approvalsApi } from '@/lib/api/tasks';
import type { CompanyDashboardStats, TaskItem, ApprovalItem } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function CompanyAdminDashV2Page() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([companiesApi.dashboard(companyId), tasksApi.list(companyId), approvalsApi.listMine(companyId)])
      .then(([s, t, a]) => {
        setStats(s);
        setTasks(t);
        setApprovals(a);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل لوحة القيادة'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!stats || !tasks || !approvals) return <Loading />;

  const completedStatuses = ['SUBMITTED', 'APPROVED', 'COMPLETED'];
  const completedToday = tasks.filter((t) => completedStatuses.includes(t.status)).length;
  const completionRate = tasks.length > 0 ? Math.round((completedToday / tasks.length) * 100) : 0;
  const overdueTasks = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && !completedStatuses.includes(t.status));
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">نظرة عامة</h1>

      <div className="grid grid-cols-4 gap-[14px]">
        <ProgressCard label="إجمالي المهام" value={tasks.length} />
        <ProgressCard label="نسبة الإنجاز" value={completionRate} suffix="٪" progress={completionRate} />
        <ProgressCard label="مهام متأخرة" value={overdueTasks.length} danger={overdueTasks.length > 0} />
        <ProgressCard label="بانتظار موافقتك" value={pendingApprovals.length} />
      </div>

      <div className="grid grid-cols-2 gap-[14px]">
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-ds-text">القوى العاملة</h2>
          <div className="flex flex-col gap-2 text-sm">
            <Row label="إجمالي المستخدمين" value={stats.totalUsers} />
            <Row label="المستخدمون النشطون" value={stats.activeUsers} />
            <Row label="عدد الفرق" value={stats.totalTeams} />
            <Row label="المحادثات النشطة" value={stats.totalConversations} />
          </div>
        </div>

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
      </div>
    </div>
  );
}

function ProgressCard({ label, value, suffix, progress, danger }: { label: string; value: number; suffix?: string; progress?: number; danger?: boolean }) {
  return (
    <div className={`rounded-dsCard border p-4 ${danger ? 'border-ds-dangerBorder bg-ds-dangerBg' : 'border-ds-cardBorder bg-ds-surface'}`}>
      <p className="text-xs text-ds-textMuted">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${danger ? 'text-ds-dangerText' : 'text-ds-text'}`}>
        {value}
        {suffix}
      </p>
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-dsPill bg-ds-trackBg">
          <div className="h-full rounded-dsPill bg-ds-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-ds-rowDivider py-1.5 last:border-0">
      <span className="text-ds-textSecondary">{label}</span>
      <span className="num font-medium text-ds-text">{value}</span>
    </div>
  );
}
