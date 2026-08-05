'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { rolesApi } from '@/lib/api/users';
import type { RoleDef, PermissionDef } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

export default function RolesMatrixPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

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

  function load() {
    if (!companyId) return;
    Promise.all([rolesApi.list(companyId), rolesApi.listAllPermissions(companyId)])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الأدوار'));
  }

  useEffect(load, [companyId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await rolesApi.create(companyId, { name, description: description || undefined });
      setName('');
      setDescription('');
      setNotice('تم إنشاء الدور');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر إنشاء الدور');
    } finally {
      setSubmitting(false);
    }
  }

  function selectRole(role: RoleDef) {
    setSelectedRoleId(role.id);
    setPendingCodes(new Set(role.permissions.map((p) => p.permission.code)));
  }

  function toggleCode(code: string) {
    setPendingCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSaveMatrix() {
    if (!selectedRoleId) return;
    setSavingMatrix(true);
    setError(null);
    try {
      await rolesApi.setPermissions(companyId, selectedRoleId, Array.from(pendingCodes));
      setNotice('تم حفظ الصلاحيات');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الصلاحيات');
    } finally {
      setSavingMatrix(false);
    }
  }

  if (error && !roles) return <ErrorBanner message={error} />;
  if (!roles) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الأدوار والصلاحيات</h1>
      {error && <ErrorBanner message={error} />}
      {notice && <div className="rounded-dsCardInner bg-ds-successBg px-3 py-2 text-sm text-ds-successText">{notice}</div>}

      {/* ---- Create role ---- */}
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-dsCard border border-ds-cardBorder bg-ds-surface p-4">
        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">اسم الدور</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ds-textMuted">الوصف (اختياري)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-dsField border border-ds-fieldBorder px-2.5 py-1.5 text-sm focus:border-ds-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !name}
          className="rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-1.5 text-sm font-medium text-white shadow-dsButton disabled:opacity-50"
        >
          {submitting ? 'جارٍ الإنشاء...' : '+ دور جديد'}
        </button>
      </form>

      {/* ---- Matrix (read view for all roles) ---- */}
      <div className="overflow-x-auto rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ds-cardBorder bg-ds-surfaceLight">
              <th className="sticky right-0 bg-ds-surfaceLight px-4 py-3 text-right text-xs font-medium text-ds-textMuted">
                الصلاحية
              </th>
              {roles.map((role) => (
                <th key={role.id} className="min-w-[130px] px-3 py-3 text-center text-xs font-medium text-ds-textMuted">
                  <button
                    onClick={() => selectRole(role)}
                    className={`rounded-dsPill px-2.5 py-1 transition ${
                      selectedRoleId === role.id ? 'bg-ds-primary text-white' : 'hover:bg-ds-primaryLight'
                    }`}
                  >
                    {role.name}
                  </button>
                  {role.isSystem && <span className="mr-1 block text-[9px] text-ds-textDisabled">(أساسي)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm.id} className="border-b border-ds-rowDivider last:border-0">
                <td className="sticky right-0 bg-ds-surface px-4 py-2.5 text-xs text-ds-text">
                  {perm.description ?? perm.code}
                </td>
                {roles.map((role) => {
                  const isEditingThisRole = selectedRoleId === role.id;
                  const granted = isEditingThisRole ? pendingCodes.has(perm.code) : role.permissions.some((p) => p.permission.code === perm.code);
                  return (
                    <td key={role.id} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => (isEditingThisRole ? toggleCode(perm.code) : selectRole(role))}
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-dsAvatar text-xs transition ${
                          granted
                            ? isEditingThisRole
                              ? 'bg-ds-primaryDark text-white ring-2 ring-ds-primary'
                              : 'bg-ds-primary text-white'
                            : 'border border-dashed border-ds-fieldBorder hover:border-ds-primaryLightBorder'
                        }`}
                      >
                        {granted ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedRoleId && (
        <div className="flex items-center gap-3 rounded-dsCard border border-ds-primaryLightBorder bg-ds-primaryLight p-4">
          <p className="text-sm text-ds-primaryDarker">
            تعديل صلاحيات: <strong>{roles.find((r) => r.id === selectedRoleId)?.name}</strong> — انقر أي خلية أعلاه للتبديل
          </p>
          <button
            onClick={handleSaveMatrix}
            disabled={savingMatrix}
            className="rounded-dsField bg-ds-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {savingMatrix ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
          </button>
          <button
            onClick={() => setSelectedRoleId(null)}
            className="rounded-dsField bg-white px-4 py-1.5 text-sm text-ds-textSecondary"
          >
            إلغاء
          </button>
        </div>
      )}
    </div>
  );
}
