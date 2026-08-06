'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DsShell } from '@/components/DsShell';
import { companiesApi } from '@/lib/api/companies';
import {
  superAdminNavGroups,
  superAdminCommands,
  superAdminScreenTitles,
  platformRoles,
} from './nav-config';

export default function SuperAdminV2Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [companyCount, setCompanyCount] = useState<number | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  // العدّاد وحالة الخدمات من الخادم — لا أرقام ثابتة في الواجهة.
  useEffect(() => {
    companiesApi
      .platformStats()
      .then((s) => {
        setCompanyCount(s.companyCount);
        setHealthOk(true);
      })
      .catch(() => setHealthOk(false));
  }, []);

  const groups = superAdminNavGroups.map((g) =>
    g.id === 'workspace'
      ? {
          ...g,
          items: g.items.map((i) =>
            i.id === 'companies' ? { ...i, count: companyCount != null ? String(companyCount) : '' } : i,
          ),
        }
      : g,
  );

  const screenTitle =
    superAdminScreenTitles[pathname] ??
    (pathname.startsWith('/super-admin-v2/spec/') ? 'مواصفة شاشة' : 'اللوحة التنفيذية');

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <DsShell
        groups={groups}
        commands={superAdminCommands}
        crumbRoot="المنصّة"
        screenTitle={screenTitle}
        productName="SASCO"
        logoUrl="/logo-sasco.png"
        userRoleLabel="مالك المنصّة"
        roles={platformRoles}
        activeRole="owner"
        headerCta={{ label: 'شركة جديدة', href: '/super-admin-v2/companies/new' }}
        serviceStatus={
          healthOk == null
            ? undefined
            : { ok: healthOk, label: healthOk ? 'كل الخدمات تعمل' : 'تعذّر الاتصال بالخادم' }
        }
      >
        {children}
      </DsShell>
    </ProtectedRoute>
  );
}
