'use client';

import { useEffect, useState } from 'react';
import { shiftsApi } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { ShiftItem, ShiftLogItem } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function ShiftsPage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ShiftItem[] | null>(null);
  const [logs, setLogs] = useState<ShiftLogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    if (!user?.companyId) return;
    shiftsApi.list(user.companyId).then(setShifts).catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الورديات'));
    shiftsApi.myLogs(user.companyId).then(setLogs).catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب سجلات الورديات'));
  }

  useEffect(load, [user]);

  const openLog = logs?.find((l) => l.status === 'OPEN');

  async function handleOpen() {
    if (!user?.companyId || !selectedShiftId) return;
    setBusy(true);
    try {
      await shiftsApi.open(user.companyId, { shiftId: selectedShiftId });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر فتح الوردية');
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(logId: string) {
    if (!user?.companyId) return;
    setBusy(true);
    try {
      await shiftsApi.close(user.companyId, logId);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إغلاق الوردية');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-lg font-bold">الورديات</h1>
      {error && <ErrorBanner message={error} />}

      {!shifts && <Loading />}

      {shifts && (
        <div className="card mb-6">
          {openLog ? (
            <div>
              <p className="mb-2 text-sm text-green-700">
                لديك وردية مفتوحة حاليًا ({openLog.shift?.name}) — بدأت {new Date(openLog.startedAt).toLocaleTimeString('ar')}
              </p>
              <button onClick={() => handleClose(openLog.id)} disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                إغلاق الوردية
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[160px]">
                <label className="label">اختر وردية لفتحها</label>
                <select className="input" value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)}>
                  <option value="">اختر...</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
              </div>
              <button onClick={handleOpen} disabled={busy || !selectedShiftId} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                فتح الوردية
              </button>
            </div>
          )}
          {shifts.length === 0 && <p className="text-sm text-slate-400">لم يُعرّف مدير الشركة أي وردية بعد</p>}
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium text-slate-700">سجل ورديّاتي</h2>
      {logs && (
        <div className="card divide-y divide-slate-100 p-0">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{l.shift?.name ?? '—'}</span>
              <span className="text-slate-500">
                {new Date(l.startedAt).toLocaleString('ar')} {l.endedAt && `→ ${new Date(l.endedAt).toLocaleString('ar')}`}
              </span>
              <span className={l.status === 'OPEN' ? 'text-green-600' : 'text-slate-400'}>{l.status}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">لا يوجد سجل ورديّات بعد</p>}
        </div>
      )}
    </div>
  );
}
