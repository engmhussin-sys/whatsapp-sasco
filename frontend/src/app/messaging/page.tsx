'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { conversationsApi } from '@/lib/api/messaging';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Conversation, AppUser } from '@/lib/types';
import { displayText } from '@/lib/message-display';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function ConversationListPage() {
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
      window.location.href = `/messaging/${conv.id}`;
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

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">المحادثات</h1>
        <button onClick={() => setShowNew((s) => !s)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          {showNew ? 'إلغاء' : '+ محادثة جديدة'}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {showNew && (
        <div className="card mb-6 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="label">ابدأ محادثة مع</label>
            <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">اختر مستخدمًا</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <button onClick={startConversation} disabled={creating || !selectedUserId} className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {creating ? 'جارٍ الإنشاء...' : 'بدء'}
          </button>
        </div>
      )}

      {!error && !conversations && <Loading />}

      {conversations && (
        <div className="card divide-y divide-slate-100 p-0">
          {conversations.map((conv) => {
            const lastMessage = conv.messages?.[0];
            return (
              <Link key={conv.id} href={`/messaging/${conv.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{otherMemberName(conv)}</p>
                  <p className="truncate text-sm text-slate-500">
                    {lastMessage
                      ? lastMessage.type === 'VOICE'
                        ? '🎤 رسالة صوتية'
                        : displayText(lastMessage, user?.preferredLanguage ?? 'ar')
                      : 'لا رسائل بعد'}
                  </p>
                </div>
                <span className="text-xs text-slate-400">{conv.type}</span>
              </Link>
            );
          })}
          {conversations.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">لا توجد محادثات بعد</p>
          )}
        </div>
      )}
    </div>
  );
}
