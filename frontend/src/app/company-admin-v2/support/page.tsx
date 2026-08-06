'use client';

import { useEffect, useState, useCallback } from 'react';
import { supportTicketsApi, type TicketSummary, type TicketDetail } from '@/lib/api/support-tickets';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const STATUS_LABELS: Record<string, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', RESOLVED: 'محلولة', CLOSED: 'مغلقة' };
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-ds-warningBg text-ds-warningText',
  IN_PROGRESS: 'bg-ds-primaryLight text-ds-primaryDarker',
  RESOLVED: 'bg-ds-successBg text-ds-successText',
  CLOSED: 'bg-ds-trackBg text-ds-textMuted',
};
const PRIORITY_LABELS: Record<string, string> = { LOW: 'منخفضة', MEDIUM: 'متوسطة', HIGH: 'عالية', URGENT: 'عاجلة' };

export default function CompanySupportV2Page() {
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
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الدعم الفني</h1>
        <button onClick={() => setShowNewForm((s) => !s)} className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton">
          {showNewForm ? 'إلغاء' : '+ تذكرة جديدة'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showNewForm && (
        <div className="flex flex-col gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <input placeholder="الموضوع" value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none" />
          <textarea
            rows={4}
            placeholder="صف المشكلة بالتفصيل..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-none rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm">
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={handleCreate} disabled={busy || !subject.trim() || !body.trim()} className="w-fit rounded-dsField bg-ds-text px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
            إرسال التذكرة
          </button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-[14px] lg:grid-cols-5">
          <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface lg:col-span-2">
            {tickets.length === 0 ? (
              <p className="p-6 text-center text-sm text-ds-textDisabled">لا توجد تذاكر بعد</p>
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
                  <p className="num text-xs text-ds-textDisabled">{new Date(t.updatedAt).toLocaleDateString('en-CA')} · {t._count?.messages ?? 0} رسالة</p>
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
                  <p className="font-bold text-ds-text">{selected.subject}</p>
                  <span className={`rounded-dsPill px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
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
                {selected.status !== 'CLOSED' && (
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
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
