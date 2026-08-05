'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { rolesApi } from '@/lib/api/users';
import type { RoleDef, PermissionDef } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

/**
 * Sprint 15 (`sp_perms` screen) — the design mockup assumes a FIXED
 * 6-role platform-wide matrix (owner/manager/supervisor/worker/etc.).
 * This platform's real RBAC is per-company CUSTOM roles with a
 * permission-code catalog (see roles-permissions module) — a company
 * defines its own roles, not a fixed enum. This screen shows THAT real
 * system as a matrix (roles × permissions, ✓ where granted) rather than
 * forcing a fictional fixed-role grid that doesn't match how the
 * platform actually works.
 */
export default function RolesMatrixPage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [permissions, setPermissions] = useState<PermissionDef[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([rolesApi.list(companyId), rolesApi.listAllPermissions(companyId)])
      .then(([r, p]) => {
        setRoles(r);
        setPermissions(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل الأدوار'));
  }, [companyId]);

  if (error) return <ErrorBanner message={error} />;
  if (!roles || !permissions) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الأدوار والصلاحيات</h1>

      <div className="overflow-x-auto rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ds-cardBorder bg-ds-surfaceLight">
              <th className="sticky right-0 bg-ds-surfaceLight px-4 py-3 text-right text-xs font-medium text-ds-textMuted">
                الصلاحية
              </th>
              {roles.map((role) => (
                <th key={role.id} className="min-w-[120px] px-3 py-3 text-center text-xs font-medium text-ds-textMuted">
                  {role.name}
                  {role.isSystem && <span className="mr-1 text-[9px] text-ds-textDisabled">(أساسي)</span>}
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
                  const granted = role.permissions.some((p) => p.permission.code === perm.code);
                  return (
                    <td key={role.id} className="px-3 py-2.5 text-center">
                      {granted ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-dsAvatar bg-ds-primary text-xs text-white">
                          ✓
                        </span>
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-dsAvatar border border-dashed border-ds-fieldBorder" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
