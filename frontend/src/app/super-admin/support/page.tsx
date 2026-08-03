'use client';

import { useEffect, useState, useCallback } from 'react';
import { supportTicketsApi, type TicketSummary, type TicketDetail } from '@/lib/api/support-tickets';
import { ApiError } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const STATUS_LABELS: Record<string, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة' };
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  RESOLVED: 'bg-brand-50 text-brand-700',
  CLOSED: 'bg-ink-100 text-ink-500',
};

export default function PlatformSupportQueuePage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    supportTicketsApi
      .listAllPlatform(statusFilter || undefined)
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب التذاكر'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function openTicket(id: string) {
    try {
      setSelected(await supportTicketsApi.getPlatform(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر جلب التذكرة');
    }
  }

  async function handleReply() {
    if (!selected || !replyBody.trim()) return;
    setBusy(true);
    try {
      await supportTicketsApi.addMessageAsPlatform(selected.id, replyBody.trim());
      setReplyBody('');
      openTicket(selected.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الردّ');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await supportTicketsApi.updateStatus(selected.id, status);
      openTicket(selected.id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تحديث الحالة');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">قائمة تذاكر الدعم (كل الشركات)</h1>
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card p-0 lg:col-span-2">
            {tickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-400">لا توجد تذاكر</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`flex w-full flex-col gap-1 border-b border-ink-50 px-4 py-3 text-right last:border-0 hover:bg-ink-50 ${
                    selected?.id === t.id ? 'bg-brand-50/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink-800">{t.subject}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  </div>
                  <p className="text-xs text-ink-400">
                    {t.company?.name ?? '—'} · {t.createdBy?.firstName} {t.createdBy?.lastName}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="card lg:col-span-3">
            {!selected ? (
              <p className="py-10 text-center text-sm text-ink-400">اختر تذكرة لعرض المحادثة</p>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-3">
                  <div>
                    <p className="font-bold text-ink-900">{selected.subject}</p>
                    <p className="text-xs text-ink-400">{selected.company?.name}</p>
                  </div>
                  <select className="input w-auto" value={selected.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={busy}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="max-h-96 space-y-3 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`rounded-xl p-3 text-sm ${m.author.systemRole === 'SUPER_ADMIN' ? 'bg-brand-50' : 'bg-ink-50'}`}>
                      <p className="mb-1 text-xs font-semibold text-ink-600">
                        {m.author.firstName} {m.author.lastName} {m.author.systemRole === 'SUPER_ADMIN' && '(الدعم الفني)'}
                      </p>
                      <p className="text-ink-800">{m.body}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{new Date(m.createdAt).toLocaleString('ar')}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                  <input className="input" placeholder="اكتب ردًّا..." value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                  <button onClick={handleReply} disabled={busy || !replyBody.trim()} className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">
                    إرسال
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
