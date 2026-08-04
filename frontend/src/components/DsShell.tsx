'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export interface DsNavLeaf {
  id: string;
  href: string;
  label: string;
}

export interface DsNavGroup {
  id: string;
  label: string;
  items: DsNavLeaf[];
}

export interface DsRole {
  id: string;
  label: string;
}

/**
 * Sprint 2 deliverable — the new layout shell from the adopted design
 * system (see final-roadmap-16-sprints.md and the Wardiya/Atheel design
 * handoff). ADDITIVE alongside the existing DashboardShell — no existing
 * route uses this yet; Sprint 3's Super Admin screens are the first
 * consumer. Company Admin routes keep the old DashboardShell until their
 * own Sprint 9 redesign.
 *
 * Uses `logoUrl` (SASCO's own logo — see project decision in
 * final-roadmap-16-sprints.md) rather than a hardcoded brand mark, since
 * the platform-owner identity is intentionally left open for later.
 */
export function DsShell({
  children,
  groups,
  roles,
  activeRole,
  onRoleChange,
  logoUrl,
  productName,
}: {
  children: React.ReactNode;
  groups: DsNavGroup[];
  roles?: DsRole[];
  activeRole?: string;
  onRoleChange?: (roleId: string) => void;
  logoUrl: string;
  productName: string;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // The group containing the current screen opens automatically —
  // matches the design spec's own navigation behavior exactly ("المجموعة
  // التي تحتوي الشاشة الحالية تُفتح تلقائيًا").
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      initial[g.id] = g.items.some((item) => pathname?.startsWith(item.href));
    }
    return initial;
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.items.some((item) => pathname?.startsWith(item.href))) next[g.id] = true;
      }
      return next;
    });
  }, [pathname, groups]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-ds-bg font-ds text-ds-text">
      {/* ---- Sidebar (258px, sticky, dark gradient) ---- */}
      <aside
        className="sticky top-0 flex h-screen w-[258px] shrink-0 flex-col bg-gradient-to-b from-ds-sidebarFrom to-ds-sidebarTo"
        style={{ paddingInlineStart: 0 }}
      >
        {/* Brand mark — SASCO logo inside a white rounded square, since a
            dark logo (matching the design handoff's own rule for the
            Atheel Tech mark) sits poorly directly on a dark sidebar. */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-white p-1">
            {/* Graceful fallback: no real SASCO logo file exists in the
                project yet (confirmed during Sprint 2) — falling back to
                the product's first letter on error avoids a broken-image
                icon in the sidebar until a real asset is uploaded. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={productName}
              className="h-full w-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden text-sm font-bold text-ds-primary">{productName[0]}</span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">{productName}</p>
          </div>
        </div>

        {/* ---- Role switcher (two-segment toggle) ---- */}
        {roles && roles.length > 0 && (
          <div className="mx-4 mb-3 flex rounded-[12px] bg-white/5 p-1">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => onRoleChange?.(role.id)}
                className={`flex-1 rounded-[9px] px-3 py-1.5 text-xs font-medium transition ${
                  activeRole === role.id ? 'bg-ds-primary text-white' : 'text-ds-onDarkSecondary hover:text-white'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        )}

        {/* ---- Grouped, collapsible navigation ---- */}
        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          {groups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            return (
              <div key={group.id} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between rounded-[10px] px-2 py-2 text-[11px] font-semibold uppercase tracking-[.1em] text-ds-onDarkGroupLabel transition hover:text-ds-onDarkSecondary"
                >
                  <span>{group.label}</span>
                  <span
                    className="inline-block text-[10px] transition-transform"
                    style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ◂
                  </span>
                </button>
                {isOpen && (
                  <div className="ds-fade flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          style={{ paddingInlineStart: '22px' }}
                          className={`rounded-[10px] px-2 py-2 text-sm transition ${
                            active ? 'bg-white/10 font-medium text-white' : 'text-ds-onDarkSecondary hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ---- Footer: signed-in user + logout ---- */}
        <div className="border-t border-white/10 px-4 py-4">
          {user && (
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-ds-coralFrom to-ds-coralTo text-xs font-semibold text-white">
                {user.firstName?.[0] ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            </div>
          )}
          <button onClick={logout} className="text-xs text-ds-onDarkMuted transition hover:text-white">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* ---- Main column: glass header + workspace ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-[66px] shrink-0 items-center justify-between px-6"
          style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(245,246,250,.82)' }}
        >
          <div className="text-sm text-ds-textSecondary">
            {/* Breadcrumb root — populated per-page by the consuming route. */}
          </div>
        </header>
        <main className="ds-fade flex-1 p-[26px]">{children}</main>
      </div>
    </div>
  );
}
