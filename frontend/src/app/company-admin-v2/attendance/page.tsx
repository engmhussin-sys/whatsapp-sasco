'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { attendanceApi, AttendanceRecord } from '@/lib/api/attendance';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function AttendanceOverviewPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    attendanceApi.today(companyId).then(setRecords).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الحضور'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!records) return <Loading />;

  const checkedIn = records.filter((r) => !r.checkOutAt);
  const checkedOut = records.filter((r) => r.checkOutAt);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الحضور اليوم</h1>

      <div className="grid grid-cols-2 gap-[14px]">
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">في الموقع الآن</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-success">{checkedIn.length}</p>
        </div>
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">انصرفوا اليوم</p>
          <p className="num mt-1 text-2xl font-semibold text-ds-textMuted">{checkedOut.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
        >
          <span>العامل</span>
          <span>وقت الحضور</span>
          <span>وقت الانصراف</span>
          <span>الحالة</span>
        </div>
        {records.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد سجلّات حضور اليوم</p>
        ) : (
          records.map((r) => (
            <div
              key={r.id}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-dsAvatar bg-gradient-to-br from-ds-secondary to-ds-secondaryDark text-xs font-semibold text-white">
                  {r.user?.firstName?.[0] ?? '?'}
                </div>
                <span className="font-medium">
                  {r.user?.firstName} {r.user?.lastName}
                </span>
              </div>
              <span className="num text-xs text-ds-textSecondary">
                {new Date(r.checkInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="num text-xs text-ds-textSecondary">
                {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </span>
              <span
                className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${
                  r.checkOutAt ? 'bg-ds-trackBg text-ds-textMuted' : 'bg-ds-successBg text-ds-successText'
                }`}
              >
                {r.checkOutAt ? 'انصرف' : 'في الموقع'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
