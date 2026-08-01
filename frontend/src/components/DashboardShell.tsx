'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface NavItem {
  href: string;
  label: string;
}

export function DashboardShell({ children, navItems }: { children: React.ReactNode; navItems: NavItem[] }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-bold text-brand-700">WorkForce Connect AI</p>
          {user && (
            <p className="mt-1 truncate text-xs text-slate-500">
              {user.firstName} {user.lastName} — {roleLabel(user.systemRole)}
            </p>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-200 p-3">
          <button
            onClick={() => logout()}
            className="w-full rounded-lg px-3 py-2 text-right text-sm text-red-600 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
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
