'use client';

import { useEffect, useState, useCallback } from 'react';
import { auditLogsApi } from '@/lib/api/audit-logs';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { AuditLogEntry } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const PAGE_SIZE = 30;

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  PERMISSION_CHANGE: 'تغيير صلاحية',
  EXPORT: 'تصدير',
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-ds-successBg text-ds-successText',
  UPDATE: 'bg-ds-primaryLight text-ds-primaryDarker',
  DELETE: 'bg-ds-dangerBg text-ds-dangerText',
  LOGIN: 'bg-ds-trackBg text-ds-textMuted',
  LOGOUT: 'bg-ds-trackBg text-ds-textMuted',
  PERMISSION_CHANGE: 'bg-ds-warningBg text-ds-warningText',
  EXPORT: 'bg-ds-secondaryBg text-ds-secondaryText',
};

export default function CompanyAuditLogsV2Page() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!user?.companyId) return;
    setLoading(true);
    auditLogsApi
      .listForCompany(user.companyId, { skip: page * PAGE_SIZE, take: PAGE_SIZE })
      .then((res) => {
        setEntries(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب سجلّ الأحداث'))
      .finally(() => setLoading(false));
  }, [user, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">سجلّ الأحداث</h1>
      {error && <ErrorBanner message={error} />}

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        {loading ? (
          <div className="p-8">
            <Loading />
          </div>
        ) : entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد أحداث مُسجَّلة بعد.</p>
        ) : (
          <>
            <div
              className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
              style={{ gridTemplateColumns: '110px 1fr 1fr 1fr' }}
            >
              <span>الحدث</span>
              <span>النوع</span>
              <span>بواسطة</span>
              <span>الوقت</span>
            </div>
            {entries.map((e) => (
              <div
                key={e.id}
                className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm last:border-0"
                style={{ gridTemplateColumns: '110px 1fr 1fr 1fr' }}
              >
                <span className={`w-fit rounded-dsPill px-2.5 py-0.5 text-xs font-semibold ${ACTION_STYLES[e.action] ?? 'bg-ds-trackBg text-ds-textMuted'}`}>
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                <span className="text-ds-textSecondary">{e.entityType}</span>
                <span className="text-ds-text">{e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : 'النظام'}</span>
                <span className="num text-xs text-ds-textDisabled">{new Date(e.createdAt).toLocaleString('en-GB')}</span>
              </div>
            ))}

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-ds-cardBorder px-4 py-3 text-sm">
                <span className="num text-ds-textMuted">{total.toLocaleString('en')} حدث — صفحة {page + 1} من {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-dsField border border-ds-fieldBorder px-3 py-1 text-ds-text disabled:opacity-40">
                    السابق
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-dsField border border-ds-fieldBorder px-3 py-1 text-ds-text disabled:opacity-40">
                    التالي
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
