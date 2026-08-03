'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardShell } from '@/components/DashboardShell';

const navItems = [
  { href: '/company-admin/dashboard', label: 'لوحة التحكم' },
  { href: '/company-admin/billing', label: 'الاشتراك والفوترة' },
  { href: '/company-admin/broadcast', label: 'إرسال للفريق' },
  { href: '/company-admin/audit-logs', label: 'سجلّ الأحداث' },
  { href: '/company-admin/support', label: 'الدعم الفني' },
  { href: '/company-admin/users', label: 'المستخدمون' },
  { href: '/company-admin/teams', label: 'الفرق' },
  { href: '/company-admin/stations', label: 'المحطات' },
  { href: '/company-admin/roles', label: 'الأدوار والصلاحيات' },
  { href: '/messaging', label: 'المحادثات' },
  { href: '/tasks', label: 'المهام' },
  { href: '/tasks/approvals', label: 'الموافقات' },
  { href: '/tasks/shifts', label: 'الورديات' },
];

export default function CompanyAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
      <DashboardShell navItems={navItems}>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
