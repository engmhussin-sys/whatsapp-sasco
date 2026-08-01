import type { SystemRole } from './types';

/** Returns the sidebar nav appropriate for the authenticated user's role. */
export function getNavItemsForRole(role: SystemRole | undefined) {
  const common = [
    { href: '/messaging', label: 'المحادثات' },
    { href: '/tasks', label: 'المهام' },
    { href: '/tasks/shifts', label: 'الورديات' },
  ];

  if (role === 'SUPER_ADMIN') {
    return [
      { href: '/super-admin/dashboard', label: 'الإحصائيات' },
      { href: '/super-admin/companies', label: 'الشركات' },
      { href: '/super-admin/subscription', label: 'الاشتراكات' },
      ...common,
    ];
  }

  if (role === 'COMPANY_ADMIN') {
    return [
      { href: '/company-admin/dashboard', label: 'لوحة التحكم' },
      { href: '/company-admin/users', label: 'المستخدمون' },
      { href: '/company-admin/teams', label: 'الفرق' },
      { href: '/company-admin/roles', label: 'الأدوار والصلاحيات' },
      ...common,
      { href: '/tasks/approvals', label: 'الموافقات' },
    ];
  }

  // TEAM_LEAD / WORKER
  return [...common, { href: '/tasks/approvals', label: 'الموافقات' }];
}
