'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { approvalsApi } from '@/lib/api/tasks';
import type { ApprovalItem } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function CompanyAdminApprovalsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  function load() {
    if (!companyId) return;
    approvalsApi.listMine(companyId).then(setApprovals).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الموافقات'));
  }

  useEffect(load, [companyId]);

  async function act(approvalId: string, action: 'APPROVE' | 'REJECT', withComment?: string) {
    setActing(approvalId);
    setError(null);
    try {
      await approvalsApi.act(companyId, approvalId, action, withComment);
      setRejectingId(null);
      setComment('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تنفيذ الإجراء');
    } finally {
      setActing(null);
    }
  }

  if (error && !approvals) return <ErrorBanner message={error} />;
  if (!approvals) return <Loading />;

  const pending = approvals.filter((a) => a.status === 'PENDING');

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الموافقات والطلبات</h1>
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-4 gap-[14px]">
        <StatCard label="بانتظار قرارك" value={pending.length} />
        <StatCard label="الخطوة الحالية" value={pending[0]?.currentStep ?? 0} />
      </div>

      <div className="flex flex-col gap-2.5">
        {pending.length === 0 ? (
          <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">
            لا توجد طلبات بانتظار قرارك
          </div>
        ) : (
          pending.map((approval) => {
            const step = approval.flow.steps.find((s) => s.stepOrder === approval.currentStep);
            return (
              <div key={approval.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ds-text">{step?.name ?? `خطوة ${approval.currentStep}`}</p>
                    <p className="mt-1 text-xs text-ds-textSecondary">يتطلّب موافقة: {step?.approverRole.name}</p>
                  </div>
                </div>

                {rejectingId === approval.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="سبب الرفض (إلزامي)"
                      className="rounded-dsField border border-ds-fieldBorder p-2 text-sm focus:border-ds-primary focus:outline-none"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(approval.id, 'REJECT', comment)}
                        disabled={!comment.trim() || acting === approval.id}
                        className="rounded-dsField bg-ds-danger px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      >
                        تأكيد الرفض
                      </button>
                      <button onClick={() => setRejectingId(null)} className="rounded-dsField bg-ds-trackBg px-4 py-1.5 text-xs text-ds-textSecondary">
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => act(approval.id, 'APPROVE')}
                      disabled={acting === approval.id}
                      className="rounded-dsField bg-ds-text px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      موافقة
                    </button>
                    <button
                      onClick={() => setRejectingId(approval.id)}
                      className="rounded-dsField border border-ds-dangerBorder px-4 py-1.5 text-xs font-medium text-ds-dangerText"
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
      <p className="text-xs text-ds-textMuted">{label}</p>
      <p className="num mt-1 text-2xl font-semibold text-ds-text">{value}</p>
    </div>
  );
}
