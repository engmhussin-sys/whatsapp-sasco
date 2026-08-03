'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardShell } from '@/components/DashboardShell';

const navItems = [
  { href: '/super-admin/dashboard', label: 'الإحصائيات' },
  { href: '/super-admin/companies', label: 'الشركات' },
  { href: '/super-admin/plans', label: 'الخطط والميزات' },
  { href: '/super-admin/coupons', label: 'الكوبونات' },
  { href: '/super-admin/audit-logs', label: 'سجلّ الأحداث' },
  { href: '/super-admin/support', label: 'الدعم الفني' },
  { href: '/super-admin/subscription', label: 'اشتراكات الشركات' },
  { href: '/messaging', label: 'المحادثات' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <DashboardShell navItems={navItems}>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
