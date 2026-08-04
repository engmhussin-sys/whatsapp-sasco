'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DsShell } from '@/components/DsShell';
import { superAdminNavGroups } from './nav-config';

export default function SuperAdminV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <DsShell groups={superAdminNavGroups} logoUrl="/logo-sasco.png" productName="SASCO">
        {children}
      </DsShell>
    </ProtectedRoute>
  );
}
