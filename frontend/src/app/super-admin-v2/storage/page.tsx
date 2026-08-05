'use client';

import { useEffect, useState } from 'react';
import { storageStatsApi, StorageSummary } from '@/lib/api/storage-stats';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function StoragePage() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storageStatsApi.getSummary().then(setSummary).catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل بيانات التخزين'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!summary) return <Loading />;

  const maxBytes = Math.max(...summary.companyBreakdown.map((c) => c.totalBytes), 1);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">التخزين</h1>

      <div className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
        <p className="text-xs text-ds-textMuted">إجمالي التخزين المُستخدَم</p>
        <p className="num mt-1 text-3xl font-semibold text-ds-text">{formatBytes(summary.platformTotalBytes)}</p>
        <p className="mt-2 text-[11px] text-ds-textDisabled">{summary.scopeNote}</p>
      </div>

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr' }}
        >
          <span>الشركة</span>
          <span>عدد الملفات</span>
          <span>الحجم الإجمالي</span>
          <span></span>
        </div>
        {summary.companyBreakdown.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد ملفات مُسجَّلة بعد</p>
        ) : (
          summary.companyBreakdown.map((c) => (
            <div
              key={c.companyId}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1.5fr' }}
            >
              <span className="font-medium">{c.companyName}</span>
              <span className="num text-xs text-ds-textSecondary">{c.fileCount}</span>
              <span className="num text-xs text-ds-textSecondary">{formatBytes(c.totalBytes)}</span>
              <div className="h-2 overflow-hidden rounded-dsPill bg-ds-trackBg">
                <div className="ds-grow h-full rounded-dsPill bg-ds-secondary" style={{ width: `${(c.totalBytes / maxBytes) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
