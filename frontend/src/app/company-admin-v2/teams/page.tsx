'use client';

import { useEffect, useState, FormEvent } from 'react';
import { teamsApi, usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Team, AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function TeamsV2Page() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMemberFor, setAddMemberFor] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  function load() {
    if (!user?.companyId) return;
    teamsApi.list(user.companyId).then(setTeams).catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الفرق'));
    usersApi.list(user.companyId).then((res) => setUsers(res.items)).catch(() => {});
  }

  useEffect(load, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user?.companyId) return;
    setSubmitting(true);
    try {
      await teamsApi.create(user.companyId, { name, description: description || undefined });
      setName('');
      setDescription('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الفريق');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddMember(teamId: string) {
    if (!user?.companyId || !selectedUserId) return;
    await teamsApi.addMember(user.companyId, teamId, selectedUserId);
    setAddMemberFor(null);
    setSelectedUserId('');
    load();
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الفرق</h1>
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-ds-textMuted">اسم الفريق</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs text-ds-textMuted">الوصف (اختياري)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-6 py-2 text-sm font-medium text-white shadow-dsButton disabled:opacity-50">
          {submitting ? 'جارٍ الإنشاء...' : 'إنشاء'}
        </button>
      </form>

      {!error && !teams && <Loading />}

      {teams && (
        <div className="grid grid-cols-2 gap-[14px]">
          {teams.length === 0 ? (
            <p className="col-span-2 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-8 text-center text-sm text-ds-textSecondary">لا توجد فرق بعد</p>
          ) : (
            teams.map((t) => (
              <div key={t.id} className="rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ds-text">{t.name}</p>
                    {t.description && <p className="mt-0.5 text-sm text-ds-textSecondary">{t.description}</p>}
                    <p className="num mt-1 text-xs text-ds-textMuted">{t._count?.members ?? 0} عضو</p>
                  </div>
                  <button onClick={() => setAddMemberFor(addMemberFor === t.id ? null : t.id)} className="text-xs font-medium text-ds-primary hover:underline">
                    + إضافة عضو
                  </button>
                </div>

                {addMemberFor === t.id && (
                  <div className="mt-3 flex gap-2">
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="flex-1 rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm"
                    >
                      <option value="">اختر مستخدمًا</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                      ))}
                    </select>
                    <button onClick={() => handleAddMember(t.id)} className="rounded-dsField bg-ds-primary px-3 py-1.5 text-xs text-white">
                      إضافة
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
