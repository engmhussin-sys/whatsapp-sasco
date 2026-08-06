'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DsCommandPalette, type DsCommand } from './DsCommandPalette';

export interface DsNavLeaf {
  id: string;
  href: string;
  label: string;
  /** عدّاد اختياري يظهر في طرف العنصر (بأرقام لاتينية). */
  count?: string;
}

export interface DsNavGroup {
  id: string;
  label: string;
  /** مجموعة بعنصر واحد بلا عنوان = عنصر مستقل في أعلى التنقّل. */
  standalone?: boolean;
  items: DsNavLeaf[];
}

export interface DsRole {
  id: string;
  label: string;
  href: string;
}

export interface DsPromo {
  title: string;
  subtitle: string;
  /** 0..100 */
  percent: number;
}

export interface DsShellProps {
  children: React.ReactNode;
  groups: DsNavGroup[];
  commands: DsCommand[];
  /** جذر مسار التصفّح — اسم الدور أو اسم الشركة. */
  crumbRoot: string;
  /** اسم الشاشة الحالية في مسار التصفّح. */
  screenTitle: string;
  productName: string;
  logoUrl: string;
  promo?: DsPromo;
  roles?: DsRole[];
  activeRole?: string;
  userRoleLabel?: string;
  headerCta?: { label: string; href?: string; onClick?: () => void };
  /** حالة الخدمات — تُمرَّر من `GET /health` بدل نص ثابت. */
  serviceStatus?: { ok: boolean; label: string };
  notificationCount?: number;
}

/**
 * قشرة لوحات التصميم المعتمد (Sprint 3+).
 *
 * إضافية بالكامل إلى جانب `DashboardShell` القديمة — الشاشات الـ34
 * القائمة لا تتأثر. كل عناصر الإطار (العلامة، التنقّل، بطاقة القائمة،
 * هوية المستخدم، مسار التصفّح، زر الترويسة، أوامر ⌘K) تُمرَّر من الخارج
 * لأنها **تابعة للدور**: لا يجوز بقاء عنصر من دور في دور آخر.
 */
export function DsShell({
  children,
  groups,
  commands,
  crumbRoot,
  screenTitle,
  productName,
  logoUrl,
  promo,
  roles,
  activeRole,
  userRoleLabel,
  headerCta,
  serviceStatus,
  notificationCount = 0,
}: DsShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const standaloneGroups = useMemo(() => groups.filter((g) => g.standalone), [groups]);
  const collapsibleGroups = useMemo(() => groups.filter((g) => !g.standalone), [groups]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <div dir="rtl" className="flex min-h-screen bg-ds-bg font-ds text-ds-text">
      {/* ══ القائمة الجانبية 258px ══ */}
      <aside className="sticky top-0 flex h-screen w-[258px] shrink-0 flex-col bg-gradient-to-b from-ds-sidebarFrom to-ds-sidebarTo px-3.5 pb-3.5 pt-4">
        {/* مبدّل الأدوار */}
        {roles && roles.length > 1 && (
          <div className="mb-4 flex gap-[3px] rounded-dsField bg-white/[.06] p-[3px]">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={role.href}
                className={`flex-1 rounded-[9px] px-2 py-1.5 text-center text-xs transition ${
                  activeRole === role.id
                    ? 'bg-white/[.14] font-medium text-white'
                    : 'text-ds-onDarkMuted hover:text-white'
                }`}
              >
                {role.label}
              </Link>
            ))}
          </div>
        )}

        {/* العلامة — الشعار الداكن داخل مربّع أبيض دائمًا */}
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-white p-[5px] shadow-[0_4px_14px_rgba(0,0,0,.28)]">
            {logoFailed ? (
              <span className="text-sm font-bold text-ds-primaryDark">{productName.charAt(0)}</span>
            ) : (
              <Image
                src={logoUrl}
                alt={productName}
                width={38}
                height={38}
                className="h-auto max-h-full w-auto max-w-full object-contain"
                onError={() => setLogoFailed(true)}
                unoptimized
              />
            )}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[16px] font-semibold text-white">{productName}</p>
            {userRoleLabel && (
              <p className="num text-[9.5px] uppercase tracking-[.12em] text-ds-onDarkMuted">{userRoleLabel}</p>
            )}
          </div>
        </div>

        {/* البحث السريع */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-4 flex w-full items-center gap-2.5 rounded-[11px] border border-white/[.09] bg-white/5 px-3 py-2 text-right text-[12.5px] text-ds-onDarkSecondary transition hover:border-white/20 hover:text-white"
        >
          <span className="flex-1">بحث سريع…</span>
          <span className="num rounded-md bg-white/10 px-1.5 py-0.5 text-[10px]">⌘K</span>
        </button>

        {/* التنقّل */}
        <nav className="ds-sidebar-nav flex flex-1 flex-col gap-[3px] overflow-y-auto">
          {standaloneGroups.flatMap((g) =>
            g.items.map((item) => <NavLeaf key={item.id} item={item} active={!!isActive(item.href)} depth={0} />),
          )}

          {collapsibleGroups.map((group) => (
            <div key={group.id}>
              <p className="mt-3.5 px-3 text-[11px] font-medium uppercase tracking-[.1em] text-ds-onDarkGroupLabel">{group.label}</p>
              <div className="mt-0.5 flex flex-col gap-[2px]">
                {group.items.map((item) => (
                  <NavLeaf key={item.id} item={item} active={!!isActive(item.href)} depth={1} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* بطاقة الاستهلاك */}
        {promo && (
          <div
            className="mt-3.5 rounded-[14px] border border-white/[.08] p-3.5"
            style={{ background: 'linear-gradient(140deg, rgba(12,124,66,.28) 0%, rgba(12,124,66,.08) 100%)' }}
          >
            <p className="mb-0.5 text-[12.5px] font-medium text-white">{promo.title}</p>
            <p className="num mb-2.5 text-[11.5px] text-ds-onDarkSecondary">{promo.subtitle}</p>
            <div className="h-[5px] overflow-hidden rounded-[4px] bg-white/[.12]">
              <div
                className="h-full rounded-[4px] bg-gradient-to-l from-ds-secondary to-ds-primary"
                style={{ width: `${Math.min(100, Math.max(0, promo.percent))}%` }}
              />
            </div>
          </div>
        )}

        {/* شعار المالك + السلوجن */}
        <div className="mt-3.5 flex items-center gap-2.5 border-t border-white/[.08] pt-3.5">
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-white/[.94] p-[3px]">
            <Image
              src="/atheel-logo.png"
              alt="أثيل تك"
              width={26}
              height={26}
              className="h-auto max-h-full w-auto max-w-full object-contain"
              unoptimized
            />
          </span>
          <span className="min-w-0 leading-snug">
            <span className="block text-[11.5px] font-medium text-[#C9CBD9]">أثيل تك</span>
            <span className="block text-[10.5px] tracking-wide text-ds-onDarkMuted">أصالة المستقبل</span>
          </span>
        </div>

        {/* المستخدم */}
        <div className="mt-2.5 flex items-center gap-2.5 rounded-dsField px-2.5 py-2.5 transition hover:bg-white/[.06]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-ds-coralFrom to-ds-coralTo text-xs font-semibold text-white">
            {user?.firstName?.charAt(0) ?? '؟'}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium text-white">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </p>
            <p className="truncate text-[11px] text-ds-onDarkMuted">{userRoleLabel ?? ''}</p>
          </div>
          <button onClick={logout} className="text-[11px] text-ds-onDarkMuted transition hover:text-white">
            خروج
          </button>
        </div>
      </aside>

      {/* ══ العمود الرئيسي ══ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-20 flex h-[66px] shrink-0 items-center gap-3.5 border-b border-ds-cardBorder px-[26px]"
          style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(245,246,250,.82)' }}
        >
          <nav aria-label="مسار التصفّح" className="flex items-center gap-2 text-[13px] text-ds-textSecondary">
            <span>{crumbRoot}</span>
            <span className="text-ds-textDisabled">›</span>
            <span className="font-medium text-ds-text">{screenTitle}</span>
          </nav>

          <div className="flex-1" />

          {serviceStatus && (
            <span
              className={`flex items-center gap-2 rounded-dsPill px-3 py-1.5 text-[12.5px] font-medium ${
                serviceStatus.ok ? 'bg-ds-successBg text-ds-successText' : 'bg-ds-dangerBg text-ds-dangerText'
              }`}
            >
              <span
                className={`ds-pulse h-[7px] w-[7px] rounded-full ${serviceStatus.ok ? 'bg-ds-success' : 'bg-ds-danger'}`}
              />
              {serviceStatus.label}
            </span>
          )}

          <Link
            href="/notifications"
            aria-label={`التنبيهات${notificationCount ? ` (${notificationCount})` : ''}`}
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-dsField border border-ds-cardBorder bg-ds-surface text-[15px] text-ds-textSecondary shadow-dsCard transition hover:border-ds-textDisabled"
          >
            ◔
            {notificationCount > 0 && (
              <span className="num absolute -left-1.5 -top-1.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-dsPill bg-ds-danger px-1 text-[10.5px] text-white shadow-[0_2px_6px_rgba(238,76,91,.45)]">
                {notificationCount}
              </span>
            )}
          </Link>

          {headerCta &&
            (headerCta.href ? (
              <Link
                href={headerCta.href}
                className="whitespace-nowrap rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-[13px] font-medium text-white shadow-dsButton transition hover:-translate-y-px"
              >
                {headerCta.label}
              </Link>
            ) : (
              <button
                onClick={headerCta.onClick}
                className="whitespace-nowrap rounded-dsField bg-gradient-to-br from-ds-primary to-ds-primaryDark px-4 py-2 text-[13px] font-medium text-white shadow-dsButton transition hover:-translate-y-px"
              >
                {headerCta.label}
              </button>
            ))}
        </header>

        <main className="ds-fade flex-1 p-[26px]">{children}</main>
      </div>

      <DsCommandPalette commands={commands} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function NavLeaf({ item, active, depth }: { item: DsNavLeaf; active: boolean; depth: 0 | 1 }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      style={{ paddingInlineStart: depth ? 22 : 12 }}
      className={`flex items-center gap-2.5 rounded-dsField py-2.5 pe-3 text-[13px] transition ${
        active
          ? 'bg-white/10 font-medium text-white shadow-[inset_0_0_0_1px_rgba(124,92,255,.3)]'
          : 'text-ds-onDarkSecondary hover:bg-white/5 hover:text-white'
      }`}
    >
      <span
        className={`h-[6px] w-[6px] shrink-0 rounded-full ${
          active ? 'bg-ds-primary' : depth ? 'bg-white/[.14]' : 'bg-transparent'
        }`}
      />
      <span className="flex-1">{item.label}</span>
      {item.count && (
        <span className={`num text-[11px] ${active ? 'text-[#8FD6AC]' : 'text-ds-onDarkGroupLabel'}`}>{item.count}</span>
      )}
    </Link>
  );
}

