'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { conversationsApi } from '@/lib/api/messaging';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Conversation, AppUser } from '@/lib/types';
import { displayText } from '@/lib/message-display';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function ConversationListV2Page() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    if (!user?.companyId) return;
    conversationsApi
      .list(user.companyId)
      .then(setConversations)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب المحادثات'));
  }

  useEffect(load, [user]);

  useEffect(() => {
    if (!user?.companyId) return;
    usersApi.list(user.companyId).then((res) => setUsers(res.items.filter((u) => u.id !== user.id))).catch(() => {});
  }, [user]);

  async function startConversation() {
    if (!user?.companyId || !selectedUserId) return;
    setCreating(true);
    try {
      const conv = await conversationsApi.create(user.companyId, { type: 'DIRECT', memberIds: [selectedUserId] });
      setShowNew(false);
      setSelectedUserId('');
      load();
      window.location.href = `/company-admin-v2/messaging/${conv.id}`;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء المحادثة');
    } finally {
      setCreating(false);
    }
  }

  function otherMemberName(conv: Conversation) {
    const other = conv.members.find((m) => m.userId !== user?.id);
    return other ? `${other.user.firstName} ${other.user.lastName}` : conv.title ?? 'محادثة';
  }

  const TYPE_LABELS: Record<string, string> = {
    DIRECT: 'مباشرة',
    GROUP: 'مجموعة',
    TEAM: 'فريق',
    ANNOUNCEMENT: 'إعلانات',
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">المحادثات</h1>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-sm font-medium text-white shadow-dsButton"
        >
          {showNew ? 'إلغاء' : '+ محادثة جديدة'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showNew && (
        <div className="flex flex-wrap items-end gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-5">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs text-ds-textMuted">ابدأ محادثة مع</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
            >
              <option value="">اختر مستخدمًا</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <button
            onClick={startConversation}
            disabled={creating || !selectedUserId}
            className="rounded-dsField bg-ds-text px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? 'جارٍ الإنشاء...' : 'بدء'}
          </button>
        </div>
      )}

      {!error && !conversations && <Loading />}

      {conversations && (
        <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
          {conversations.length === 0 ? (
            <p className="p-8 text-center text-sm text-ds-textSecondary">لا توجد محادثات بعد</p>
          ) : (
            conversations.map((conv) => {
              const lastMessage = conv.messages?.[0];
              return (
                <Link
                  key={conv.id}
                  href={`/company-admin-v2/messaging/${conv.id}`}
                  className="flex items-center justify-between border-b border-ds-rowDivider px-4 py-3.5 transition hover:bg-ds-surfaceLight last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-primaryLight text-sm font-semibold text-ds-primaryDarker">
                      {otherMemberName(conv).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ds-text">{otherMemberName(conv)}</p>
                      <p className="truncate text-sm text-ds-textSecondary">
                        {lastMessage
                          ? lastMessage.type === 'VOICE'
                            ? 'رسالة صوتية'
                            : displayText(lastMessage, user?.preferredLanguage ?? 'ar')
                          : 'لا رسائل بعد'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-dsPill bg-ds-trackBg px-2.5 py-1 text-xs text-ds-textMuted">
                    {TYPE_LABELS[conv.type] ?? conv.type}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
