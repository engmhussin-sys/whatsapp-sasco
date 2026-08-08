'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { tasksApi, type TaskReportSummary } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api-client';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ASSIGNED: 'مُسنَدة',
  IN_PROGRESS: 'قيد التنفيذ',
  SUBMITTED: 'مُرسَلة',
  APPROVED: 'مُعتمَدة',
  REJECTED: 'مرفوضة',
  RETURNED: 'مُعادة',
  COMPLETED: 'مكتملة',
  CANCELED: 'مُلغاة',
};

export default function TaskReportsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [summary, setSummary] = useState<TaskReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!companyId) return;
    setError(null);
    tasksApi
      .getReportSummary(companyId)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر تحميل التقرير'));
  }

  useEffect(load, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!summary) return <Loading />;

  const completionPercent = summary.completionRate !== null ? Math.round(summary.completionRate * 100) : null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">تقارير المهام</h1>
        <button
          onClick={load}
          className="w-fit rounded-dsField border border-ds-fieldBorder px-4 py-2 text-sm font-medium text-ds-text"
        >
          تحديث
        </button>
      </div>

      {/* بطاقات الملخص */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">إجمالي المهام</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-text">{summary.totalTasks}</p>
        </div>
        <div className="rounded-dsCard border border-ds-successBorder bg-ds-successBg p-4">
          <p className="text-xs text-ds-successText">نسبة الإنجاز</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-successText">
            {completionPercent !== null ? `${completionPercent}%` : '—'}
          </p>
        </div>
        <div className="rounded-dsCard border border-ds-dangerBorder bg-ds-dangerBg p-4">
          <p className="text-xs text-ds-dangerText">مهام متأخرة</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-dangerText">{summary.overdueCount}</p>
        </div>
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">جداول متكررة نشطة</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-text">{summary.activeRecurringSchedules}</p>
        </div>
      </div>

      {/* توزيع الحالات */}
      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ds-text">توزيع الحالات</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 rounded-dsPill bg-ds-trackBg px-3 py-1.5 text-xs">
              <span className="text-ds-textSecondary">{STATUS_LABELS[status] ?? status}</span>
              <span className="num font-semibold text-ds-text">{count}</span>
            </div>
          ))}
          {Object.keys(summary.byStatus).length === 0 && <p className="text-xs text-ds-textDisabled">لا توجد بيانات بعد</p>}
        </div>
      </div>

      {/* حسب الفريق */}
      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ds-text">حسب الفريق</h2>
        <div className="flex flex-col gap-2">
          {summary.byTeam.map((t) => (
            <div key={t.teamId ?? 'unassigned'} className="flex items-center justify-between rounded-dsCardInner border border-ds-cardBorder px-3 py-2">
              <span className="text-sm text-ds-text">{t.teamName}</span>
              <div className="flex gap-3 text-xs">
                <span className="text-ds-textMuted">
                  الإجمالي: <span className="num font-semibold text-ds-text">{t.total}</span>
                </span>
                <span className="text-ds-successText">
                  مكتملة: <span className="num font-semibold">{t.completed}</span>
                </span>
                {t.overdue > 0 && (
                  <span className="text-ds-dangerText">
                    متأخرة: <span className="num font-semibold">{t.overdue}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
          {summary.byTeam.length === 0 && <p className="text-xs text-ds-textDisabled">لا توجد بيانات بعد</p>}
        </div>
      </div>

      {/* قائمة المهام المتأخرة */}
      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ds-text">المهام المتأخرة ({summary.overdueCount})</h2>
        <div className="flex flex-col gap-2">
          {summary.overdueTasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-dsCardInner border border-ds-dangerBorder bg-ds-dangerBg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ds-text">{t.title}</p>
                <p className="text-xs text-ds-textMuted">{STATUS_LABELS[t.status] ?? t.status}</p>
              </div>
              {t.dueAt && <span className="num text-xs text-ds-dangerText">{new Date(t.dueAt).toLocaleDateString('en-CA')}</span>}
            </div>
          ))}
          {summary.overdueTasks.length === 0 && <p className="text-xs text-ds-textDisabled">لا توجد مهام متأخرة — ممتاز</p>}
        </div>
      </div>
    </div>
  );
}
