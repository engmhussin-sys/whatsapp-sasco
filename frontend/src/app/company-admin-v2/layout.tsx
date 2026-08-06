'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DsShell } from '@/components/DsShell';
import { useAuth } from '@/lib/auth-context';
import { companiesApi } from '@/lib/api/companies';
import { reportsApi } from '@/lib/api/reports';
import {
  companyAdminNavGroups,
  companyAdminCommands,
  companyScreenTitles,
  companyRoles,
} from './nav-config';

/**
 * قشرة إدارة الشركة.
 *
 * كل عنصر في الإطار يُمرَّر من هنا لأنه **تابع للدور** — الترويسة، مسار
 * التصفّح، بطاقة المقاعد، مبدّل الأدوار، وأوامر ⌘K. النسخة المنشورة كانت
 * تمرّر `groups` و`logoUrl` و`productName` فقط، فبقيت الترويسة فارغة ولم
 * تعمل ⌘K ولم يظهر مبدّل الأدوار.
 */
export default function CompanyAdminV2Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const companyId = user?.companyId ?? '';

  const [logoUrl, setLogoUrl] = useState('/logo-sasco.png');
  const [productName, setProductName] = useState('SASCO');
  const [pending, setPending] = useState<number>(0);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!companyId) return;

    companiesApi
      .get(companyId)
      .then((c) => {
        if (c.brandLogoUrl) setLogoUrl(c.brandLogoUrl);
        setProductName(c.name);
      })
      .catch(() => {
        // فشل جلب العلامة لا يستحق تعطيل القشرة — الافتراضي كافٍ.
      });

    // العدّادات وحالة الخدمة من الخادم — لا أرقام ثابتة في التنقّل.
    reportsApi
      .companyOverview(companyId)
      .then((o) => {
        setPending(o.approvals.pending + o.fuelRequests.pending);
        setHealthOk(true);
      })
      .catch(() => setHealthOk(false));
  }, [companyId]);

  const groups = companyAdminNavGroups.map((g) =>
    g.id === 'root'
      ? {
          ...g,
          items: g.items.map((i) =>
            i.id === 'approvals' ? { ...i, count: pending > 0 ? String(pending) : '' } : i,
          ),
        }
      : g,
  );

  return (
    <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
      <DsShell
        groups={groups}
        commands={companyAdminCommands}
        crumbRoot={productName}
        screenTitle={companyScreenTitles[pathname] ?? 'وردية اليوم'}
        productName={productName}
        logoUrl={logoUrl}
        userRoleLabel="مدير الشركة"
        roles={companyRoles}
        activeRole="company"
        headerCta={{ label: 'تقرير الوردية', href: '/company-admin-v2/dash' }}
        notificationCount={pending}
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
