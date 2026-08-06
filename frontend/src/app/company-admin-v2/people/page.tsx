'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/api/users';
import type { AppUser } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { ErrorBanner } from '@/components/ErrorBanner';

// Sprint 9 scope note: the design's `co_people` grid shows "الحالة" as a
// live in-site/late/away presence status — that requires the Attendance
// module (Sprint 11), which doesn't exist yet. This shows what's
// honestly available today instead: account active/inactive and last
// login, not a fabricated presence indicator.
export default function CompanyAdminPeoplePage() {
  const { user } = useAuth();
  const companyId = user?.companyId ?? '';

  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!companyId) return;
    usersApi
      .list(companyId, { search: search || undefined })
      .then((res) => setUsers(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'تعذّر تحميل المستخدمين'));
  }, [companyId, search]);

  if (error && !users) return <ErrorBanner message={error} />;
  if (!users) return <Loading />;

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ds-text">الفرق والمواقع</h1>
      {error && <ErrorBanner message={error} />}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ابحث عن عامل..."
        className="w-[280px] rounded-dsField border border-ds-fieldBorder bg-ds-surface px-3 py-2 text-sm text-ds-text placeholder:text-ds-textDisabled focus:border-ds-primary focus:outline-none"
      />

      <div className="overflow-hidden rounded-dsCard border border-ds-cardBorder bg-ds-surface">
        <div
          className="grid gap-3 border-b border-ds-cardBorder bg-ds-surfaceLight px-4 py-3 text-xs font-medium text-ds-textMuted"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 110px' }}
        >
          <span>العامل</span>
          <span>الدور</span>
          <span>اللغة</span>
          <span>آخر دخول</span>
          <span>الحالة</span>
        </div>
        {users.length === 0 ? (
          <p className="p-8 text-center text-sm text-ds-textSecondary">لا يوجد مستخدمون مطابقون</p>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="grid items-center gap-3 border-b border-ds-rowDivider px-4 py-3 text-sm text-ds-text last:border-0"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 110px' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-dsAvatar bg-gradient-to-br from-ds-coralFrom to-ds-coralTo text-xs font-semibold text-white">
                  {u.firstName[0]}
                </div>
                <span className="font-medium">
                  {u.firstName} {u.lastName}
                </span>
              </div>
              <span className="text-xs text-ds-textSecondary">{u.systemRole}</span>
              <span className="text-xs text-ds-textSecondary">{u.preferredLanguage}</span>
              <span className="num text-xs text-ds-textMuted">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-CA') : '—'}
              </span>
              <span
                className={`w-fit rounded-dsPill px-2.5 py-1 text-xs ${
                  u.isActive ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-trackBg text-ds-textMuted'
                }`}
              >
                {u.isActive ? 'نشط' : 'معطَّل'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
