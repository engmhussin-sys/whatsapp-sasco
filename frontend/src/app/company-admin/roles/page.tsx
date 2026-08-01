'use client';

import { useEffect, useState, FormEvent } from 'react';
import { rolesApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { RoleDef } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    if (!user?.companyId) return;
    rolesApi
      .list(user.companyId)
      .then(setRoles)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الأدوار'));
  }

  useEffect(load, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!user?.companyId) return;
    setSubmitting(true);
    try {
      await rolesApi.create(user.companyId, { name, description: description || undefined });
      setName('');
      setDescription('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الدور');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-bold">الأدوار والصلاحيات</h1>
      <p className="mb-4 text-sm text-slate-500">
        الأدوار هنا مخصّصة لكل شركة (مثل &quot;Supervisor&quot; أو &quot;Manager&quot;) وتُستخدَم في تعريف خطوات
        الموافقات (Approval Flows) — وليست الأدوار الأساسية للنظام (Worker/Team Lead/Company Admin).
      </p>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleCreate} className="card mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[160px]">
          <label className="label">اسم الدور</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Supervisor" />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label">الوصف (اختياري)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-auto px-6">
          {submitting ? 'جارٍ الإنشاء...' : 'إنشاء'}
        </button>
      </form>

      {!error && !roles && <Loading />}

      {roles && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {roles.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.name}</p>
                {r.isSystem && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">نظامي</span>}
              </div>
              {r.description && <p className="mt-1 text-sm text-slate-500">{r.description}</p>}
              <p className="mt-2 text-xs text-slate-400">{r.permissions.length} صلاحية مرتبطة</p>
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-slate-400">لا توجد أدوار مخصّصة بعد</p>}
        </div>
      )}
    </div>
  );
}
