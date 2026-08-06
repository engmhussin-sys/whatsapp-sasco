'use client';

import { useEffect, useState, useCallback } from 'react';
import { supportTicketsApi, type TicketSummary, type TicketDetail } from '@/lib/api/support-tickets';
import { ApiError } from '@/lib/api-client';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const STATUS_LABELS: Record<string, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة' };
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-ds-warningBg text-ds-warningText',
  IN_PROGRESS: 'bg-ds-primaryLight text-ds-primaryDarker',
  RESOLVED: 'bg-ds-successBg text-ds-successText',
  CLOSED: 'bg-ds-trackBg text-ds-textMuted',
};

export default function PlatformSupportQueueV2Page() {
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
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">قائمة تذاكر الدعم (كل الشركات)</h1>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-[14px] lg:grid-cols-5">
          <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface lg:col-span-2">
            {tickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-ds-textDisabled">لا توجد تذاكر</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openTicket(t.id)}
                  className={`flex w-full flex-col gap-1 border-b border-ds-rowDivider px-4 py-3 text-right last:border-0 hover:bg-ds-surfaceLight ${selected?.id === t.id ? 'bg-ds-primaryLight' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ds-text">{t.subject}</p>
                    <span className={`rounded-dsPill px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  </div>
                  <p className="text-xs text-ds-textDisabled">{t.company?.name ?? '—'} · {t.createdBy?.firstName} {t.createdBy?.lastName}</p>
                </button>
              ))
            )}
          </div>

          <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5 lg:col-span-3">
            {!selected ? (
              <p className="py-10 text-center text-sm text-ds-textDisabled">اختر تذكرة لعرض المحادثة</p>
            ) : (
              <div>
                <div className="mb-3 flex items-center justify-between border-b border-ds-rowDivider pb-3">
                  <div>
                    <p className="font-bold text-ds-text">{selected.subject}</p>
                    <p className="text-xs text-ds-textDisabled">{selected.company?.name}</p>
                  </div>
                  <select value={selected.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={busy} className="w-auto rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
                  {selected.messages.map((m) => (
                    <div key={m.id} className={`rounded-dsCard p-3 text-sm ${m.author.systemRole === 'SUPER_ADMIN' ? 'bg-ds-primaryLight' : 'bg-ds-surfaceLight'}`}>
                      <p className="mb-1 text-xs font-semibold text-ds-textSecondary">
                        {m.author.firstName} {m.author.lastName} {m.author.systemRole === 'SUPER_ADMIN' && '(الدعم الفني)'}
                      </p>
                      <p className="text-ds-text">{m.body}</p>
                      <p className="num mt-1 text-[11px] text-ds-textDisabled">{new Date(m.createdAt).toLocaleString('en-GB')}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2 border-t border-ds-rowDivider pt-3">
                  <input
                    placeholder="اكتب ردًّا..."
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    className="flex-1 rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
                  />
                  <button onClick={handleReply} disabled={busy || !replyBody.trim()} className="shrink-0 rounded-dsField bg-ds-primary px-4 py-2 text-sm text-white disabled:opacity-50">
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
