'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi, type NotificationEntry } from '@/lib/api/notifications';
import { ApiError } from '@/lib/api-client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

const TYPE_ICONS: Record<string, string> = {
  TASK_ASSIGNED: '📋',
  APPROVAL_REQUESTED: '✅',
  APPROVAL_DECIDED: '📝',
  FUEL_REQUEST_UPDATED: '⛽',
  BROADCAST_RECEIVED: '📢',
  SUBSCRIPTION_EXPIRING: '⏰',
  SYSTEM: '🚨',
};

const PAGE_SIZE = 20;

function NotificationsPageContent() {
  const router = useRouter();
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    notificationsApi
      .list({ skip: page * PAGE_SIZE, take: PAGE_SIZE, unreadOnly })
      .then((res) => {
        setEntries(res.items);
        setTotal(res.total);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الإشعارات'))
      .finally(() => setLoading(false));
  }, [page, unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(entry: NotificationEntry) {
    if (!entry.isRead) {
      await notificationsApi.markAsRead(entry.id).catch(() => {});
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, isRead: true } : e)));
    }
    if (entry.link) router.push(entry.link);
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllAsRead().catch(() => {});
    setEntries((prev) => prev.map((e) => ({ ...e, isRead: true })));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-ink-50 p-6 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm text-ink-500 hover:text-ink-900">
          → رجوع
        </button>
        <h1 className="text-lg font-bold">كل الإشعارات</h1>
        <div className="w-12" />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setPage(0);
              setUnreadOnly(e.target.checked);
            }}
            className="h-4 w-4 rounded border-ink-300"
          />
          غير المقروءة فقط
        </label>
        <button onClick={handleMarkAllRead} className="text-sm font-medium text-brand-600 hover:underline">
          تحديد الكل كمقروء
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="card p-0">
        {loading ? (
          <div className="p-6">
            <Loading />
          </div>
        ) : entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-400">لا توجد إشعارات</p>
        ) : (
          <>
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleClick(entry)}
                className={`flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-right transition last:border-0 hover:bg-ink-50 ${
                  !entry.isRead ? 'bg-brand-50/30' : ''
                }`}
              >
                <span className="mt-0.5 shrink-0 text-lg">{TYPE_ICONS[entry.type] ?? '🔔'}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${!entry.isRead ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{entry.title}</p>
                  {entry.body && <p className="mt-0.5 text-sm text-ink-500">{entry.body}</p>}
                  <p className="mt-1 text-xs text-ink-300">{new Date(entry.createdAt).toLocaleString('ar')}</p>
                </div>
                {!entry.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </button>
            ))}

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-sm">
                <span className="text-ink-400">
                  {total.toLocaleString('ar')} إشعار — صفحة {page + 1} من {totalPages}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-ink-200 px-3 py-1 disabled:opacity-40">
                    السابق
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded-lg border border-ink-200 px-3 py-1 disabled:opacity-40"
                  >
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

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsPageContent />
    </ProtectedRoute>
  );
}
