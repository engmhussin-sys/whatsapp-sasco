'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { tasksApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { TaskItem } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  ASSIGNED: 'مُسندة',
  IN_PROGRESS: 'قيد التنفيذ',
  SUBMITTED: 'أُرسلت',
  APPROVED: 'معتمدة',
  REJECTED: 'مرفوضة',
  RETURNED: 'أُعيدت',
  COMPLETED: 'مكتملة',
  CANCELED: 'ملغاة',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ASSIGNED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  SUBMITTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  RETURNED: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELED: 'bg-slate-100 text-slate-500',
};

export default function TasksListPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!user?.companyId) return;
    tasksApi
      .list(user.companyId, { status: statusFilter || undefined, assignedToUserId: user.id })
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المهام'));
  }, [user, statusFilter]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">المهام</h1>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} />}
      {!error && !tasks && <Loading />}

      {tasks && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tasks.map((t) => (
            <Link key={t.id} href={`/tasks/${t.id}`} className="card block hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{t.title}</p>
                  {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs shrink-0 ${STATUS_COLORS[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </span>
              </div>
              {t.dueAt && (
                <p className="mt-2 text-xs text-slate-400">الموعد النهائي: {new Date(t.dueAt).toLocaleDateString('ar')}</p>
              )}
            </Link>
          ))}
          {tasks.length === 0 && <p className="text-sm text-slate-400">لا توجد مهام حاليًا</p>}
        </div>
      )}
    </div>
  );
}
