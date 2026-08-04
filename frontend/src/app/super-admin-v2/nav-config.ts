import type { DsNavGroup } from '@/components/DsShell';

/**
 * Matches information-architecture.md's Super Admin IA exactly. Only
 * items marked 🟢 (live) point to real routes in Sprint 3; 🟡 items get
 * added as their own sprints ship (module marketplace UI = sprint 5,
 * taxonomy = sprint 6, etc.) — until then they're simply absent from
 * this list rather than linking to a page that doesn't exist yet.
 */
export const superAdminNavGroups: DsNavGroup[] = [
  {
    id: 'workspace',
    label: 'مساحة العمل',
    items: [
      { id: 'dash', href: '/super-admin-v2/dash', label: 'لوحة القيادة' },
      { id: 'companies', href: '/super-admin-v2/companies', label: 'الشركات' },
    ],
  },
  {
    id: 'subscriptions',
    label: 'الاشتراكات',
    items: [
      { id: 'plans', href: '/super-admin/plans', label: 'الخطط' },
      { id: 'coupons', href: '/super-admin/coupons', label: 'القسائم' },
    ],
  },
  {
    id: 'monitoring',
    label: 'المراقبة',
    items: [{ id: 'audit', href: '/super-admin/audit-logs', label: 'سجلّ الأحداث' }],
  },
  {
    id: 'support',
    label: 'الدعم',
    items: [{ id: 'support', href: '/super-admin/support', label: 'تذاكر الدعم' }],
  },
];
