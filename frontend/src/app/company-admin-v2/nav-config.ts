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
      { id: 'work-orders', href: '/company-admin-v2/work-orders', label: 'أوامر العمل' },
      { id: 'attendance', href: '/company-admin-v2/attendance', label: 'الحضور والانصراف' },
    ],
  },
  {
    id: 'people',
    label: 'الأشخاص',
    items: [
      { id: 'people', href: '/company-admin-v2/people', label: 'الفرق والمواقع' },
      { id: 'users', href: '/company-admin/users', label: 'المستخدمون' },
      { id: 'teams', href: '/company-admin/teams', label: 'الفرق' },
      { id: 'roles', href: '/company-admin-v2/roles', label: 'الأدوار والصلاحيات' },
    ],
  },
  {
    id: 'assets',
    label: 'الأصول',
    items: [
      { id: 'assets', href: '/company-admin-v2/assets', label: 'إدارة الأصول' },
      { id: 'fleet', href: '/company-admin-v2/fleet', label: 'إدارة الأسطول' },
    ],
  },
  {
    id: 'compliance-safety',
    label: 'الامتثال والسلامة',
    items: [
      { id: 'visitors', href: '/company-admin-v2/visitors', label: 'إدارة الزوّار' },
      { id: 'training', href: '/company-admin-v2/training', label: 'التدريب والشهادات' },
      { id: 'compliance', href: '/company-admin-v2/compliance', label: 'الامتثال' },
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
      { id: 'branding', href: '/company-admin-v2/branding', label: 'العلامة التجارية' },
      { id: 'knowledge-base', href: '/company-admin-v2/knowledge-base', label: 'قاعدة المعرفة' },
    ],
  },
];
