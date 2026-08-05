'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { complianceApi, ComplianceRequirement } from '@/lib/api/visitors-training-compliance';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const STATUS_LABELS: Record<string, string> = { OPEN: 'مفتوح', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'مكتمل', OVERDUE: 'متأخر' };

export default function CompliancePage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [items, setItems] = useState<ComplianceRequirement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!companyId) return;
    complianceApi.list(companyId).then(setItems).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل متطلبات الامتثال'));
  }

  useEffect(load, [companyId]);

  async function markCompleted(id: string) {
    try {
      await complianceApi.update(companyId, id, { status: 'COMPLETED' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر التحديث');
    }
  }

  if (error && !items) return <ErrorBanner message={error} />;
  if (!items) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الامتثال</h1>
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-col gap-2.5">
        {items.length === 0 ? (
          <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">
            لا توجد متطلبات امتثال مُسجَّلة
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`rounded-dsCard border p-4 ${item.isOverdue ? 'border-ds-dangerBorder bg-ds-dangerBg' : 'border-ds-cardBorder bg-ds-surface'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-ds-text">{item.name}</p>
                  {item.description && <p className="mt-1 text-xs text-ds-textSecondary">{item.description}</p>}
                  {item.dueAt && (
                    <p className="num mt-1 text-[11px] text-ds-textMuted">استحقاق: {new Date(item.dueAt).toLocaleDateString('en-CA')}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-dsPill px-2.5 py-1 text-xs ${
                      item.status === 'COMPLETED' ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-trackBg text-ds-textMuted'
                    }`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  {item.status !== 'COMPLETED' && (
                    <button onClick={() => markCompleted(item.id)} className="rounded-dsField bg-ds-text px-3 py-1 text-xs text-white">
                      إتمام
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
