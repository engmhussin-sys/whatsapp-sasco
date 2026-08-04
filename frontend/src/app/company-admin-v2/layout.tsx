'use client';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DsShell } from '@/components/DsShell';
import { companyAdminNavGroups } from './nav-config';

export default function CompanyAdminV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
      <DsShell groups={companyAdminNavGroups} logoUrl="/logo-sasco.png" productName="SASCO">
        {children}
      </DsShell>
    </ProtectedRoute>
  );
}
