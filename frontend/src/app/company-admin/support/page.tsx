'use client';

import { useEffect, useState, useCallback } from 'react';
import { supportTicketsApi, type TicketSummary, type TicketDetail } from '@/lib/api/support-tickets';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const STATUS_LABELS: Record<string, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة' };
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  RESOLVED: 'bg-brand-50 text-brand-700',
  CLOSED: 'bg-ink-100 text-ink-500',
};
const PRIORITY_LABELS: Record<string, string> = { LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة' };

export default function CompanySupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [replyBody, setReplyBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!user?.companyId) return;
    setLoading(true);
    supportTicketsApi
      .listForCompany(user.companyId)
      .then(setTickets)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب التذاكر'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function openTicket(id: string) {
    if (!user?.companyId) return;
    try {
      const detail = await supportTicketsApi.getForCompany(user.companyId, id);
      setSelected(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر جلب التذكرة');
    }
  }

  async function handleCreate() {
    if (!user?.companyId || !subject.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await supportTicketsApi.create(user.companyId, subject.trim(), body.trim(), priority);
      setSubject('');
      setBody('');
      setShowNewForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء التذكرة');
    } finally {
      setBusy(false);
    }
  }

  async function handleReply() {
    if (!user?.companyId || !selected || !replyBody.trim()) return;
    setBusy(true);
    try {
      await supportTicketsApi.addMessageAsCompany(user.companyId, selected.id, replyBody.trim());
      setReplyBody('');
      openTicket(selected.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إرسال الردّ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">الدعم الفني</h1>
        <button onClick={() => setShowNewForm((s) => !s)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white">
          {showNewForm ? 'إلغاء' : '+ تذكرة جديدة'}
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showNewForm && (
        <div className="card mb-6 space-y-3">
          <input className="input" placeholder="الموضوع" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input resize-none" rows={4} placeholder="صف المشكلة بالتفصيل..." value={body} onChange={(e) => setBody(e.target.value)} />
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button onClick={handleCreate} disabled={busy || !subject.trim() || !body.trim()} className="btn-primary">
            إرسال التذكرة
          </button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="card p-0 lg:col-span-2">
            {tickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-400">لا توجد تذاكر بعد</p>
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
                  <p className="text-xs text-ink-400">{new Date(t.updatedAt).toLocaleDateString('ar')} · {t._count?.messages ?? 0} رسالة</p>
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
                  <p className="font-bold text-ink-900">{selected.subject}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
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
                {selected.status !== 'CLOSED' && (
                  <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                    <input className="input" placeholder="اكتب ردًّا..." value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
                    <button onClick={handleReply} disabled={busy || !replyBody.trim()} className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">
                      إرسال
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
