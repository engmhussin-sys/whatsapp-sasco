import type { DsNavGroup } from '@/components/DsShell';

/** Matches information-architecture.md's Company Admin IA — only 🟢
 * live items get real routes here; 🟡 roadmap items (attendance,
 * assets, etc.) are simply absent until their own sprint ships. */
export const companyAdminNavGroups: DsNavGroup[] = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    items: [{ id: 'dashboard', href: '/company-admin-v2/dash', label: 'لوحة القيادة' }],
  },
  {
    id: 'operations',
    label: 'العمليات',
    items: [
      { id: 'tasks', href: '/company-admin-v2/tasks', label: 'المهام' },
      { id: 'approvals', href: '/company-admin-v2/approvals', label: 'الموافقات' },
    ],
  },
  {
    id: 'people',
    label: 'الأشخاص',
    items: [
      { id: 'people', href: '/company-admin-v2/people', label: 'الفرق والمواقع' },
      { id: 'users', href: '/company-admin/users', label: 'المستخدمون' },
      { id: 'teams', href: '/company-admin/teams', label: 'الفرق' },
    ],
  },
  {
    id: 'communication',
    label: 'التواصل',
    items: [
      { id: 'chat', href: '/messaging', label: 'المحادثات' },
      { id: 'broadcast', href: '/company-admin/broadcast', label: 'الرسائل الجماعية' },
    ],
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    items: [
      { id: 'billing', href: '/company-admin/billing', label: 'الفوترة' },
      { id: 'settings', href: '/company-admin/settings', label: 'الإعدادات' },
    ],
  },
];
