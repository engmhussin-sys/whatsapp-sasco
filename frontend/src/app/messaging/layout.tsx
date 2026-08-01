'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardShell } from '@/components/DashboardShell';
import { useAuth } from '@/lib/auth-context';
import { getNavItemsForRole } from '@/lib/nav-items';

export default function MessagingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      <DashboardShell navItems={getNavItemsForRole(user?.systemRole)}>{children}</DashboardShell>
    </ProtectedRoute>
  );
}
