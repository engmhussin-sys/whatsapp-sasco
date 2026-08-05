'use client';

import { useEffect, useState } from 'react';
import { securitySessionsApi, LoginSession } from '@/lib/api/security-sessions';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function LoginSessionsPage() {
  const [sessions, setSessions] = useState<LoginSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function load() {
    securitySessionsApi.listActive().then(setSessions).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الجلسات'));
  }

  useEffect(load, []);

  async function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    try {
      await securitySessionsApi.revoke(sessionId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنهاء الجلسة');
    } finally {
      setRevokingId(null);
    }
  }

  if (error && !sessions) return <ErrorBanner message={error} />;
  if (!sessions) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">جلسات الدخول النشطة</h1>
      {error && <ErrorBanner message={error} />}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 90px' }}
        >
          <span>المستخدم</span>
          <span>الجهاز</span>
          <span>عنوان IP</span>
          <span>بدأت</span>
          <span></span>
        </div>
        {sessions.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد جلسات نشطة</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 90px' }}
            >
              <span className="font-medium">
                {s.user.firstName} {s.user.lastName}
              </span>
              <span className="truncate text-xs text-ds-textSecondary" title={s.userAgent ?? undefined}>
                {s.userAgent ?? '—'}
              </span>
              <span className="num text-xs text-ds-textMuted" dir="ltr">
                {s.ipAddress ?? '—'}
              </span>
              <span className="num text-xs text-ds-textMuted">{new Date(s.createdAt).toLocaleDateString('en-CA')}</span>
              <button
                onClick={() => handleRevoke(s.id)}
                disabled={revokingId === s.id}
                className="rounded-dsField border border-ds-dangerBorder px-2.5 py-1 text-xs text-ds-dangerText disabled:opacity-50"
              >
                إنهاء
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
