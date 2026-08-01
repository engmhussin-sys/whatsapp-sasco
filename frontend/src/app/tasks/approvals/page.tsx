'use client';

import { useEffect, useState } from 'react';
import { approvalsApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { ApprovalItem } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    if (!user?.companyId) return;
    approvalsApi
      .listMine(user.companyId)
      .then(setApprovals)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الموافقات'));
  }

  useEffect(load, [user]);

  async function act(approvalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN') {
    if (!user?.companyId) return;
    setActing(approvalId);
    try {
      await approvalsApi.act(user.companyId, approvalId, action, commentDrafts[approvalId]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تنفيذ الإجراء');
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-bold">الموافقات المُعلَّقة</h1>
      <p className="mb-4 text-sm text-slate-500">
        تعرض هذه الشاشة فقط الموافقات التي يحق لدورك الحالي التصرف بها في هذه الخطوة تحديدًا.
      </p>

      {error && <ErrorBanner message={error} />}
      {!error && !approvals && <Loading />}

      {approvals && (
        <div className="space-y-4">
          {approvals.map((a) => {
            const currentStepDef = a.flow.steps.find((s) => s.stepOrder === a.currentStep);
            return (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">طلب #{a.id.slice(0, 8)}</p>
                    <p className="text-sm text-slate-500">
                      الخطوة الحالية: {currentStepDef?.name} ({currentStepDef?.approverRole.name})
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{a.status}</span>
                </div>

                {a.actions.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {a.actions.map((act) => (
                      <p key={act.id}>
                        خطوة {act.stepOrder} — {act.action} {act.comment && `— "${act.comment}"`}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <textarea
                    className="input"
                    placeholder="تعليق (اختياري)"
                    rows={2}
                    value={commentDrafts[a.id] ?? ''}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    disabled={acting === a.id}
                    onClick={() => act(a.id, 'APPROVE')}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    موافقة
                  </button>
                  <button
                    disabled={acting === a.id}
                    onClick={() => act(a.id, 'RETURN')}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    إعادة
                  </button>
                  <button
                    disabled={acting === a.id}
                    onClick={() => act(a.id, 'REJECT')}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              </div>
            );
          })}
          {approvals.length === 0 && <p className="text-sm text-slate-400">لا توجد موافقات معلّقة بانتظارك حاليًا</p>}
        </div>
      )}
    </div>
  );
}
