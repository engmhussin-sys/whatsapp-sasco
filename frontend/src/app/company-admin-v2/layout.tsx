'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DsShell } from '@/components/DsShell';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { companyAdminNavGroups } from './nav-config';

export default function CompanyAdminV2Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [logoUrl, setLogoUrl] = useState('/logo-sasco.png');
  const [productName, setProductName] = useState('SASCO');

  // Sprint 16 — per-company branding. Falls back to SASCO's own
  // defaults (unchanged pre-Sprint-16 behavior) until this company's
  // real branding loads, or if they never customized it.
  useEffect(() => {
    if (!user?.companyId) return;
    companiesApi
      .get(user.companyId)
      .then((c) => {
        if (c.brandLogoUrl) setLogoUrl(c.brandLogoUrl);
        setProductName(c.name);
      })
      .catch(() => {
        // Branding fetch failing is not worth blocking the shell over —
        // the SASCO defaults above are a perfectly good fallback.
      });
  }, [user?.companyId]);

  return (
    <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
      <DsShell groups={companyAdminNavGroups} logoUrl={logoUrl} productName={productName}>
        {children}
      </DsShell>
    </ProtectedRoute>
  );
}
