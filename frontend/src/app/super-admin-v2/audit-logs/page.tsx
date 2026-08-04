'use client';

import { useEffect, useState } from 'react';
import { auditLogsApi } from '@/lib/api/audit-logs';
import type { AuditLogEntry } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  LOGIN: 'دخول',
  LOGOUT: 'خروج',
  PERMISSION_CHANGE: 'تغيير صلاحية',
  EXPORT: 'تصدير',
};

export default function AuditLogsV2Page() {
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auditLogsApi
      .listPlatform({ take: 100 })
      .then((res) => setEntries(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل سجلّ الأحداث'));
  }, []);

  if (error) return <ErrorBanner message={error} />;
  if (!entries) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">سجلّ الأحداث</h1>

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '1.2fr 1.2fr 1.1fr 1.5fr' }}
        >
          <span>الوقت</span>
          <span>الفاعل</span>
          <span>الإجراء</span>
          <span>الهدف</span>
        </div>
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد أحداث مُسجَّلة</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="grid gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '1.2fr 1.2fr 1.1fr 1.5fr' }}
            >
              <span className="num text-xs text-ds-textSecondary">
                {new Date(e.createdAt).toLocaleString('en-CA', { hour12: false })}
              </span>
              <span className="text-xs">{e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'النظام'}</span>
              <span>
                <span className="rounded-dsPill bg-ds-primaryLight px-2 py-0.5 text-[11px] text-ds-primaryDarker">
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
              </span>
              <span className="text-xs text-ds-textSecondary">
                {e.entityType}
                {e.entityId ? ` #${e.entityId.slice(0, 8)}` : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
