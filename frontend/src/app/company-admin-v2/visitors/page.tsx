'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { visitorsApi, Visitor } from '@/lib/api/visitors-training-compliance';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function VisitorsPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [purpose, setPurpose] = useState('');

  function load() {
    if (!companyId) return;
    visitorsApi.today(companyId).then(setVisitors).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الزوّار'));
  }

  useEffect(load, [companyId]);

  async function handleCheckIn() {
    try {
      await visitorsApi.checkIn(companyId, { fullName, purpose: purpose || undefined });
      setFullName('');
      setPurpose('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الزائر');
    }
  }

  async function handleCheckOut(visitorId: string) {
    try {
      await visitorsApi.checkOut(companyId, visitorId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الانصراف');
    }
  }

  if (error && !visitors) return <ErrorBanner message={error} />;
  if (!visitors) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">إدارة الزوّار</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          + تسجيل زائر
        </button>
      </div>
      {error && <ErrorBanner message={error} />}

      {showForm && (
        <div className="flex items-end gap-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">الاسم</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">الغرض</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm" />
          </div>
          <button onClick={handleCheckIn} disabled={!fullName} className="rounded-dsField bg-ds-text px-4 py-1.5 text-sm text-white disabled:opacity-50">
            تسجيل دخول
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
          <span>الزائر</span>
          <span>الغرض</span>
          <span>وقت الدخول</span>
          <span>الحالة</span>
        </div>
        {visitors.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا يوجد زوّار اليوم</p>
        ) : (
          visitors.map((v) => (
            <div key={v.id} className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0" style={{ gridTemplateColumns: '2fr 1fr 1fr 100px' }}>
              <span className="font-medium">{v.fullName}</span>
              <span className="text-xs text-ds-textSecondary">{v.purpose ?? '—'}</span>
              <span className="num text-xs text-ds-textSecondary">{new Date(v.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              {v.checkOutAt ? (
                <span className="w-fit rounded-dsPill bg-ds-trackBg px-2.5 py-1 text-xs text-ds-textMuted">غادر</span>
              ) : (
                <button onClick={() => handleCheckOut(v.id)} className="w-fit rounded-dsPill bg-ds-successBg px-2.5 py-1 text-xs text-ds-successText">
                  تسجيل خروج
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
