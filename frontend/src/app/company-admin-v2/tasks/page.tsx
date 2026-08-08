'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { tasksApi } from '@/lib/api/tasks';
import type { TaskItem } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

type Column = 'not_started' | 'in_progress' | 'late' | 'completed';

const COLUMNS: { id: Column; label: string; dot: string }[] = [
  { id: 'not_started', label: 'لم تبدأ', dot: 'bg-ds-trackFillLighter' },
  { id: 'in_progress', label: 'قيد التنفيذ', dot: 'bg-ds-primary' },
  { id: 'late', label: 'متأخرة', dot: 'bg-ds-danger' },
  { id: 'completed', label: 'مكتملة', dot: 'bg-ds-success' },
];

function bucketFor(task: TaskItem): Column {
  const completedStatuses = ['SUBMITTED', 'APPROVED', 'COMPLETED'];
  if (completedStatuses.includes(task.status)) return 'completed';

  const isOverdue = task.dueAt ? new Date(task.dueAt).getTime() < Date.now() : false;
  if (isOverdue) return 'late';

  if (task.status === 'IN_PROGRESS') return 'in_progress';
  return 'not_started'; // DRAFT, ASSIGNED
}

export default function CompanyAdminTasksBoardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const companyId = user?.companyId ?? '';

  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    tasksApi.list(companyId).then(setTasks).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل المهام'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!tasks) return <Loading />;

  const byColumn = COLUMNS.map((col) => ({ ...col, tasks: tasks.filter((t) => bucketFor(t) === col.id) }));

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">لوحة المهام</h1>
        <button
          onClick={() => router.push('/company-admin-v2/tasks/new')}
          className="w-fit rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          + مهمة جديدة
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {byColumn.map((col) => (
          <div key={col.id} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <span className="text-sm font-semibold text-ds-text">{col.label}</span>
              <span className="num rounded-dsPill bg-ds-trackBg px-1.5 py-0.5 text-[11px] text-ds-textMuted">{col.tasks.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {col.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`rounded-dsCardInner border bg-ds-surface p-3 shadow-dsCard ${
                    col.id === 'late' ? 'border-ds-dangerBorder' : 'border-ds-cardBorder'
                  }`}
                >
                  <p className="text-sm font-medium text-ds-text">{task.title}</p>
                  {task.dueAt && (
                    <p className="num mt-1 text-[11px] text-ds-textMuted">
                      {new Date(task.dueAt).toLocaleDateString('en-CA')}
                    </p>
                  )}
                  {task.template && <p className="mt-1 text-[11px] text-ds-textSecondary">{task.template.name}</p>}
                </div>
              ))}
              {col.tasks.length === 0 && (
                <div className="rounded-dsCardInner border-2 border-dashed border-ds-fieldBorder p-4 text-center text-xs text-ds-textDisabled">
                  لا توجد مهام
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
