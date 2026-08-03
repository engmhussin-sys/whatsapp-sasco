'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { rolesApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { RoleDef, PermissionDef } from '@/lib/types';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Loading } from '@/components/Loading';

// Groups permission codes by their domain prefix (e.g. "users.create" -> "users")
// for a readable, sectioned matrix instead of one long flat list.
const DOMAIN_LABELS: Record<string, string> = {
  users: 'المستخدمون',
  teams: 'الفرق',
  stations: 'المحطات',
  tasks: 'المهام',
  approvals: 'الموافقات',
  shifts: 'الورديات',
  fuel_requests: 'طلبات الوقود',
  conversations: 'المحادثات',
  roles: 'الأدوار والصلاحيات',
  billing: 'الفوترة',
  reports: 'التقارير',
  audit_logs: 'سجلّ الأحداث',
};

export default function RolesPage() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(new Set());
  const [savingMatrix, setSavingMatrix] = useState(false);

  const load = useCallback(() => {
    if (!user?.companyId) return;
    Promise.all([rolesApi.list(user.companyId), rolesApi.listAllPermissions(user.companyId)])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'تعذّر جلب الأدوار والصلاحيات'));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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

  function openMatrix(role: RoleDef) {
    setSelectedRoleId(role.id);
    setPendingCodes(new Set(role.permissions.map((p) => p.permission.code)));
    setNotice(null);
  }

  function toggleCode(code: string) {
    setPendingCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleDomain(domain: string, domainCodes: string[]) {
    const allSelected = domainCodes.every((c) => pendingCodes.has(c));
    setPendingCodes((prev) => {
      const next = new Set(prev);
      domainCodes.forEach((c) => (allSelected ? next.delete(c) : next.add(c)));
      return next;
    });
  }

  async function handleSaveMatrix() {
    if (!user?.companyId || !selectedRoleId) return;
    setSavingMatrix(true);
    setError(null);
    try {
      await rolesApi.setPermissions(user.companyId, selectedRoleId, Array.from(pendingCodes));
      setNotice('✅ حُفظت الصلاحيات بنجاح');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر حفظ الصلاحيات');
    } finally {
      setSavingMatrix(false);
    }
  }

  const permissionsByDomain = permissions.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    const domain = p.code.split('.')[0];
    (acc[domain] ??= []).push(p);
    return acc;
  }, {});

  const selectedRole = roles?.find((r) => r.id === selectedRoleId);

  return (
    <div>
      <h1 className="mb-2 text-lg font-bold">الأدوار والصلاحيات</h1>
      <p className="mb-4 text-sm text-ink-500">
        أنشئ دورًا مخصَّصًا (مثل &quot;Supervisor&quot;) ثم حدِّد صلاحياته بدقة عبر شبكة الصلاحيات أدناه.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <form onSubmit={handleCreate} className="card mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="label">اسم الدور</label>
          <input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Supervisor" />
        </div>
        <div className="min-w-[160px] flex-1">
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
            <button key={r.id} onClick={() => openMatrix(r)} className="card text-right transition hover:border-brand-300">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.name}</p>
                {r.isSystem && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">نظامي</span>}
              </div>
              {r.description && <p className="mt-1 text-sm text-ink-500">{r.description}</p>}
              <p className="mt-2 text-xs text-brand-600">{r.permissions.length} صلاحية — إدارة الصلاحيات ←</p>
            </button>
          ))}
          {roles.length === 0 && <p className="text-sm text-ink-400">لا توجد أدوار مخصّصة بعد</p>}
        </div>
      )}

      {/* ---- Permission Matrix modal ---- */}
      {selectedRole && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedRoleId(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-white px-5 py-4">
              <div>
                <p className="text-sm font-bold text-ink-900">صلاحيات: {selectedRole.name}</p>
                <p className="text-xs text-ink-400">{pendingCodes.size} صلاحية مُحدَّدة</p>
              </div>
              <button onClick={() => setSelectedRoleId(null)} className="text-ink-400 hover:text-ink-700">
                ✕
              </button>
            </div>

            {notice && <div className="mx-5 mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{notice}</div>}

            <div className="space-y-5 px-5 py-4">
              {Object.entries(permissionsByDomain).map(([domain, domainPerms]) => {
                const domainCodes = domainPerms.map((p) => p.code);
                const allSelected = domainCodes.every((c) => pendingCodes.has(c));
                return (
                  <div key={domain}>
                    <div className="mb-2 flex items-center justify-between border-b border-ink-100 pb-1.5">
                      <p className="text-sm font-semibold text-ink-800">{DOMAIN_LABELS[domain] ?? domain}</p>
                      <button onClick={() => toggleDomain(domain, domainCodes)} className="text-xs font-medium text-brand-600 hover:underline">
                        {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {domainPerms.map((p) => (
                        <label key={p.code} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
                          <input type="checkbox" checked={pendingCodes.has(p.code)} onChange={() => toggleCode(p.code)} className="h-4 w-4 rounded border-ink-300" />
                          <span className="text-ink-700">{p.description ?? p.code}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {permissions.length === 0 && <p className="text-sm text-ink-400">لا توجد صلاحيات مُعرَّفة في النظام بعد.</p>}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-100 bg-white px-5 py-3">
              <button onClick={() => setSelectedRoleId(null)} className="rounded-lg border border-ink-200 px-4 py-2 text-sm text-ink-700">
                إغلاق
              </button>
              <button onClick={handleSaveMatrix} disabled={savingMatrix} className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white disabled:opacity-50">
                {savingMatrix ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
