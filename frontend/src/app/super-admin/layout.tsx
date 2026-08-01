'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardShell } from '@/components/DashboardShell';

const navItems = [
  { href: '/super-admin/dashboard', label: 'الإحصائيات' },
  { href: '/super-admin/companies', label: 'الشركات' },
  { href: '/super-admin/subscription', label: 'الاشتراكات' },
  { href: '/messaging', label: 'المحادثات' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <DashboardShell navItems={navItems}>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
