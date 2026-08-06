import type { DsNavGroup, DsRole } from '@/components/DsShell';
import type { DsCommand } from '@/components/DsCommandPalette';

/**
 * بنية معلومات مالك المنصّة — 8 مجموعات / 24 شاشة، مطابقة لخريطة
 * المعلومات في حزمة التصميم (README §12).
 *
 * العناصر التي لم تُبنَ شاشتها بعد تُوجَّه إلى `/super-admin-v2/spec/[id]`
 * التي تعرض مواصفتها الرسمية بدل رابط مكسور أو صفحة فارغة.
 */

const spec = (id: string) => `/super-admin-v2/spec/${id}`;

export const superAdminNavGroups: DsNavGroup[] = [
  {
    id: 'root',
    label: '',
    standalone: true,
    items: [
      { id: 'dash', href: '/super-admin-v2/dash', label: 'اللوحة التنفيذية' },
      { id: 'ia', href: '/super-admin-v2/ia', label: 'خريطة المعلومات' },
    ],
  },
  {
    id: 'workspace',
    label: 'مساحة العمل',
    items: [
      { id: 'companies', href: '/super-admin-v2/companies', label: 'الشركات', count: '—' },
      { id: 'co_new', href: '/super-admin-v2/companies/new', label: 'إنشاء شركة جديدة' },
      { id: 'entitlements', href: '/super-admin-v2/entitlements', label: 'الصلاحيات والخدمات' },
      { id: 'branches', href: spec('branches'), label: 'الفروع والمواقع' },
    ],
  },
  {
    id: 'users',
    label: 'المستخدمون',
    items: [
      { id: 'co_admins', href: spec('co-admins'), label: 'مديرو الشركات' },
      { id: 'support_team', href: spec('support-team'), label: 'فريق الدعم' },
      { id: 'operators', href: spec('operators'), label: 'المشغّلون' },
    ],
  },
  {
    id: 'subscriptions',
    label: 'الاشتراكات',
    items: [
      { id: 'plans', href: '/super-admin-v2/plans', label: 'الخطط' },
      { id: 'invoices', href: '/super-admin-v2/subscription', label: 'الفواتير والمدفوعات' },
      { id: 'coupons', href: '/super-admin-v2/coupons', label: 'الكوبونات' },
    ],
  },
  {
    id: 'monitoring',
    label: 'المراقبة',
    items: [
      { id: 'analytics', href: spec('analytics'), label: 'التحليلات' },
      { id: 'ai_usage', href: '/super-admin-v2/ai-usage', label: 'استهلاك الذكاء' },
      { id: 'health', href: '/super-admin-v2/health', label: 'صحة النظام' },
      { id: 'storage', href: '/super-admin-v2/storage', label: 'التخزين' },
    ],
  },
  {
    id: 'security',
    label: 'الأمن والصلاحيات',
    items: [
      { id: 'roles', href: spec('roles'), label: 'الأدوار' },
      { id: 'perms', href: '/super-admin-v2/roles-matrix', label: 'الصلاحيات' },
      { id: 'audit', href: '/super-admin-v2/audit-logs', label: 'سجل التدقيق' },
      { id: 'sessions', href: '/super-admin-v2/sessions', label: 'جلسات الدخول' },
    ],
  },
  {
    id: 'platform',
    label: 'المنصّة',
    items: [
      { id: 'modules', href: '/super-admin-v2/modules', label: 'متجر الوحدات', count: '18' },
      { id: 'forms', href: '/super-admin-v2/forms', label: 'منشئ النماذج' },
      { id: 'worker', href: spec('worker-app'), label: 'تطبيق العامل' },
      { id: 'languages', href: spec('languages'), label: 'اللغات والترجمة' },
      { id: 'ai_models', href: spec('ai-models'), label: 'نماذج الذكاء' },
      { id: 'settings', href: spec('settings'), label: 'الإعدادات العامة' },
    ],
  },
  {
    id: 'support',
    label: 'الدعم',
    items: [
      { id: 'tickets', href: '/super-admin-v2/support', label: 'التذاكر' },
      { id: 'kb', href: spec('knowledge-base'), label: 'قاعدة المعرفة' },
    ],
  },
];

export const superAdminCommands: DsCommand[] = [
  { id: 'new_co', label: 'إضافة شركة جديدة (معالج)', href: '/super-admin-v2/companies/new', icon: '＋', shortcut: 'C N', keywords: 'company new wizard انشاء' },
  { id: 'entitle', label: 'صلاحيات وخدمات شركة', href: '/super-admin-v2/entitlements', icon: '◆', shortcut: 'G E', keywords: 'entitlements modules صلاحيات' },
  { id: 'companies', label: 'الانتقال إلى الشركات', href: '/super-admin-v2/companies', icon: '◫', shortcut: 'G C', keywords: 'companies tenants' },
  { id: 'invoices', label: 'الفواتير والمدفوعات', href: '/super-admin-v2/subscription', icon: '₪', shortcut: 'G I', keywords: 'invoices billing' },
  { id: 'modules', label: 'متجر الوحدات', href: '/super-admin-v2/modules', icon: '▧', shortcut: 'G M', keywords: 'modules marketplace' },
  { id: 'forms', label: 'منشئ النماذج', href: '/super-admin-v2/forms', icon: '⌗', shortcut: 'F N', keywords: 'forms builder' },
  { id: 'audit', label: 'سجل التدقيق', href: '/super-admin-v2/audit-logs', icon: '☰', shortcut: 'G A', keywords: 'audit logs' },
];

export const platformRoles: DsRole[] = [
  { id: 'owner', label: 'مالك المنصّة', href: '/super-admin-v2/dash' },
  { id: 'company', label: 'إدارة الشركة', href: '/company-admin-v2/shift' },
];

/** خريطة العنوان لكل مسار — تُستخدم في مسار التصفّح. */
export const superAdminScreenTitles: Record<string, string> = {
  '/super-admin-v2/dash': 'اللوحة التنفيذية',
  '/super-admin-v2/ia': 'خريطة المعلومات',
  '/super-admin-v2/companies': 'الشركات',
  '/super-admin-v2/companies/new': 'إنشاء شركة جديدة',
  '/super-admin-v2/entitlements': 'الصلاحيات والخدمات',
  '/super-admin-v2/taxonomy': 'القطاعات والتسميات',
  '/super-admin-v2/modules': 'متجر الوحدات',
  '/super-admin-v2/forms': 'منشئ النماذج',
  '/super-admin-v2/health': 'صحة النظام',
  '/super-admin-v2/audit': 'سجل التدقيق',
  '/super-admin-v2/roles-matrix': 'الأدوار والصلاحيات',
  '/super-admin-v2/plans': 'الخطط',
  '/super-admin-v2/coupons': 'الكوبونات',
  '/super-admin-v2/support': 'الدعم الفني',
  '/super-admin-v2/subscription': 'الفواتير والمدفوعات',
  '/super-admin-v2/sessions': 'جلسات الدخول',
};
