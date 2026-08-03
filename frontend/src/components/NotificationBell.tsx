'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notificationsApi, type NotificationEntry } from '@/lib/api/notifications';

const TYPE_ICONS: Record<string, string> = {
  TASK_ASSIGNED: '📋',
  APPROVAL_REQUESTED: '✅',
  APPROVAL_DECIDED: '📝',
  FUEL_REQUEST_UPDATED: '⛽',
  BROADCAST_RECEIVED: '📢',
  SUBSCRIPTION_EXPIRING: '⏰',
  SYSTEM: '🚨',
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    // Polling fallback (in addition to whatever real-time push the
    // backend already emits via the `user:{id}` socket room) — keeps
    // the badge correct even if the socket connection drops.
    const interval = setInterval(refreshUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleToggle() {
    setOpen((o) => !o);
    if (!open) {
      setLoading(true);
      notificationsApi
        .list({ take: 8 })
        .then((res) => setEntries(res.items))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }

  async function handleEntryClick(entry: NotificationEntry) {
    setOpen(false);
    if (!entry.isRead) {
      await notificationsApi.markAsRead(entry.id).catch(() => {});
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (entry.link) router.push(entry.link);
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllAsRead().catch(() => {});
    setEntries((prev) => prev.map((e) => ({ ...e, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-50"
        aria-label="الإشعارات"
      >
        <span className="text-lg">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -left-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-20 w-80 rounded-xl border border-ink-100 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
            <p className="text-sm font-bold text-ink-900">الإشعارات</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-center text-sm text-ink-400">جارٍ التحميل...</p>
            ) : entries.length === 0 ? (
              <p className="p-4 text-center text-sm text-ink-400">لا توجد إشعارات بعد</p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleEntryClick(entry)}
                  className={`flex w-full items-start gap-2.5 border-b border-ink-50 px-3 py-2.5 text-right transition last:border-0 hover:bg-ink-50 ${
                    !entry.isRead ? 'bg-brand-50/30' : ''
                  }`}
                >
                  <span className="shrink-0 text-base">{TYPE_ICONS[entry.type] ?? '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${!entry.isRead ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{entry.title}</p>
                    {entry.body && <p className="truncate text-xs text-ink-400">{entry.body}</p>}
                    <p className="mt-0.5 text-[11px] text-ink-300">{new Date(entry.createdAt).toLocaleString('ar')}</p>
                  </div>
                  {!entry.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                </button>
              ))
            )}
          </div>

          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 px-3 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-ink-50">
            عرض كل الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}
