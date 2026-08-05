'use client';

import { useEffect, useState } from 'react';
import { systemHealthApi, SystemHealthSnapshot } from '@/lib/api/system-health';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}ي ${hours}س`;
  if (hours > 0) return `${hours}س ${minutes}د`;
  return `${minutes}د`;
}

export default function SystemHealthPage() {
  const [snapshot, setSnapshot] = useState<SystemHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    systemHealthApi.getSnapshot().then(setSnapshot).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل حالة النظام'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!snapshot) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">صحة النظام</h1>
      <p className="text-xs text-ds-textMuted">
        لقطة لحظية حقيقية — لا يوجد سجلّ تاريخي (90 يومًا) بعد، لعدم وجود بنية مراقبة تجمع هذه البيانات حتى الآن.
      </p>

      <div className="grid grid-cols-4 gap-[14px]">
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">مدة التشغيل الحالية</p>
          <p className="num mt-1 text-xl font-semibold text-ds-text">{formatUptime(snapshot.apiUptimeSeconds)}</p>
        </div>
        <div className={`rounded-dsCard border p-4 ${snapshot.database.healthy ? 'border-ds-cardBorder bg-ds-surface' : 'border-ds-dangerBorder bg-ds-dangerBg'}`}>
          <p className="text-xs text-ds-textMuted">قاعدة البيانات</p>
          <p className={`mt-1 text-xl font-semibold ${snapshot.database.healthy ? 'text-ds-success' : 'text-ds-dangerText'}`}>
            {snapshot.database.healthy ? 'متصلة' : 'غير متصلة'}
          </p>
          {snapshot.database.latencyMs != null && (
            <p className="num mt-0.5 text-[11px] text-ds-textMuted">{snapshot.database.latencyMs} مللي ثانية</p>
          )}
        </div>
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">الذاكرة المُستخدَمة</p>
          <p className="num mt-1 text-xl font-semibold text-ds-text">{snapshot.memory.heapUsedMb} MB</p>
        </div>
        <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
          <p className="text-xs text-ds-textMuted">نشاط آخر 24 ساعة</p>
          <p className="num mt-1 text-xl font-semibold text-ds-text">{snapshot.recentActivity24h}</p>
          <p className="text-[11px] text-ds-textMuted">إجراء مُسجَّل</p>
        </div>
      </div>

      <p className="num text-xs text-ds-textDisabled">آخر قياس: {new Date(snapshot.measuredAt).toLocaleString('en-GB')}</p>
    </div>
  );
}
