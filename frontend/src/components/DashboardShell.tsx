'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

export function DashboardShell({ children, navItems }: { children: React.ReactNode; navItems: NavItem[] }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const commandItems = [
    ...navItems,
    { href: '/notifications', label: 'كل الإشعارات', icon: '🔔' },
  ];

  return (
    <div className="flex min-h-screen bg-ink-50 dark:bg-ink-900">
      <CommandPalette items={commandItems} />

      <aside className="flex w-64 shrink-0 flex-col border-l border-ink-100 bg-white dark:border-ink-700 dark:bg-ink-800">
        {/* ---- Brand mark ---- */}
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-5 py-5 dark:border-ink-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-lg">⛽</div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-ink-900 dark:text-ink-50">ساسكو</p>
            <p className="text-[11px] font-medium leading-tight text-ink-400">SASCO Connect</p>
          </div>
        </div>

        {/* ---- User card ---- */}
        {user && (
          <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-xl bg-ink-50 px-3 py-2.5 dark:bg-ink-700/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              {user.firstName?.[0]}
              {user.lastName?.[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink-900 dark:text-ink-50">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-ink-400">{roleLabel(user.systemRole)}</p>
            </div>
          </div>
        )}

        {/* ---- Navigation ---- */}
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                    : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900 dark:hover:bg-ink-700/50 dark:hover:text-ink-50'
                }`}
              >
                {active && <span className="absolute inset-y-1 right-0 w-0.5 rounded-full bg-brand-500" />}
                {item.icon && <span className="ml-1.5">{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ---- Command palette hint ---- */}
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-400 dark:bg-ink-700/50">
            <span>بحث سريع</span>
            <kbd className="rounded border border-ink-200 px-1.5 py-0.5 dark:border-ink-600">⌘K</kbd>
          </div>
        </div>

        {/* ---- Sign out ---- */}
        <div className="border-t border-ink-100 p-3 dark:border-ink-700">
          <button
            onClick={() => logout()}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm text-ink-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            تسجيل الخروج
            <span aria-hidden>←</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-end gap-1 border-b border-ink-100 bg-white px-6 py-2.5 dark:border-ink-700 dark:bg-ink-800 md:px-8">
          <ThemeToggle />
          <NotificationBell />
        </div>
        <div className="mx-auto max-w-6xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'مدير المنصة',
    COMPANY_ADMIN: 'مدير الشركة',
    TEAM_LEAD: 'قائد فريق',
    WORKER: 'عامل',
  };
  return map[role] ?? role;
}
