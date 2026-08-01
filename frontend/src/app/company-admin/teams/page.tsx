'use client';

import { useEffect, useState, FormEvent } from 'react';
import { teamsApi } from '@/lib/api/users';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Team, AppUser } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function TeamsPage() {
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
    teamsApi
      .list(user.companyId)
      .then(setTeams)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الفرق'));
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
    <div>
      <h1 className="mb-4 text-lg font-bold">الفرق</h1>
      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleCreate} className="card mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="label">اسم الفريق</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">الوصف (اختياري)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-auto px-6">
          {submitting ? 'جارٍ الإنشاء...' : 'إنشاء'}
        </button>
      </form>

      {!error && !teams && <Loading />}

      {teams && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  {t.description && <p className="text-sm text-slate-500">{t.description}</p>}
                  <p className="mt-1 text-xs text-slate-400">{t._count?.members ?? 0} عضو</p>
                </div>
                <button
                  onClick={() => setAddMemberFor(addMemberFor === t.id ? null : t.id)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  + إضافة عضو
                </button>
              </div>

              {addMemberFor === t.id && (
                <div className="mt-3 flex gap-2">
                  <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                    <option value="">اختر مستخدمًا</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => handleAddMember(t.id)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs text-white">
                    إضافة
                  </button>
                </div>
              )}
            </div>
          ))}
          {teams.length === 0 && <p className="text-sm text-slate-400">لا توجد فرق بعد</p>}
        </div>
      )}
    </div>
  );
}
