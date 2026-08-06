import type { DsNavGroup, DsRole } from '@/components/DsShell';
import type { DsCommand } from '@/components/DsCommandPalette';

/**
 * بنية معلومات إدارة الشركة — 5 مجموعات + شاشتان مستقلتان.
 *
 * تصحيحان عن النسخة المنشورة:
 *  1. «نظرة عامة» كانت مجموعة بعنوان وعنصر واحد — صارت عنصرًا مستقلًا
 *     بأعلى التنقّل (المجموعة ذات العنصر الواحد ضجيج بصري).
 *  2. «المستخدمون» و«الفرق» و«الفرق والمواقع» كانت ثلاثة مداخل متقاربة
 *     تُشوّش الدور — وُحّدت في «العمال والفرق» مع إبقاء الشاشتين القديمتين
 *     كمسارَين فرعيَّين حتى تُستبدلا.
 *
 * ⚠ «المحادثات» و«الرسائل الجماعية» و«الفوترة» و«الإعدادات» تشير إلى
 * الشاشات القديمة (`/messaging`, `/company-admin/*`) المبنيّة على النظام
 * الأخضر `brand-*` — الانتقال إليها يقفز بالمستخدم بين نظامَي تصميم.
 * أُبقيت الروابط عاملة، لكن نقلها إلى `ds-*` هو السبرنت التالي.
 */
export const companyAdminNavGroups: DsNavGroup[] = [
  {
    id: 'root',
    label: '',
    standalone: true,
    items: [
      { id: 'dashboard', href: '/company-admin-v2/dash', label: 'وردية اليوم' },
      { id: 'approvals', href: '/company-admin-v2/approvals', label: 'الموافقات والطلبات' },
    ],
  },
  {
    id: 'work',
    label: 'العمل',
    items: [
      { id: 'tasks', href: '/company-admin-v2/tasks', label: 'لوحة المهام' },
      { id: 'work-orders', href: '/company-admin-v2/work-orders', label: 'أوامر العمل' },
      { id: 'attendance', href: '/company-admin-v2/attendance', label: 'الحضور والانصراف' },
    ],
  },
  {
    id: 'people',
    label: 'الناس',
    items: [
      { id: 'people', href: '/company-admin-v2/people', label: 'العمال والفرق' },
      { id: 'roles', href: '/company-admin-v2/roles', label: 'الأدوار والصلاحيات' },
      { id: 'training', href: '/company-admin-v2/training', label: 'التدريب والشهادات' },
    ],
  },
  {
    id: 'communication',
    label: 'التواصل',
    items: [
      { id: 'chat', href: '/messaging', label: 'المحادثات' },
      { id: 'broadcast', href: '/company-admin/broadcast', label: 'البث والإعلانات' },
      { id: 'kb', href: '/company-admin-v2/knowledge-base', label: 'قاعدة المعرفة' },
    ],
  },
  {
    id: 'assets',
    label: 'الأصول والامتثال',
    items: [
      { id: 'assets', href: '/company-admin-v2/assets', label: 'إدارة الأصول' },
      { id: 'fleet', href: '/company-admin-v2/fleet', label: 'إدارة الأسطول' },
      { id: 'visitors', href: '/company-admin-v2/visitors', label: 'إدارة الزوّار' },
      { id: 'compliance', href: '/company-admin-v2/compliance', label: 'الامتثال والسلامة' },
    ],
  },
  {
    id: 'settings',
    label: 'الإعدادات',
    items: [
      { id: 'billing', href: '/company-admin/billing', label: 'الفاتورة والاشتراك' },
      { id: 'branding', href: '/company-admin-v2/branding', label: 'العلامة التجارية' },
      { id: 'settings', href: '/company-admin/settings', label: 'إعدادات الشركة' },
    ],
  },
];

/** أوامر ⌘K الخاصة بإدارة الشركة — لا تُخلط بأوامر مالك المنصّة. */
export const companyAdminCommands: DsCommand[] = [
  { id: 'new_task', label: 'مهمة جديدة وإسنادها لفريق', href: '/company-admin-v2/tasks', icon: '＋', shortcut: 'T N', keywords: 'task new مهمة' },
  { id: 'approvals', label: 'الموافقات المعلّقة', href: '/company-admin-v2/approvals', icon: '◐', shortcut: 'G A', keywords: 'approvals موافقات' },
  { id: 'shift', label: 'ملخّص الوردية الآن', href: '/company-admin-v2/dash', icon: '✦', shortcut: 'G S', keywords: 'shift summary وردية' },
  { id: 'people', label: 'العمال والفرق', href: '/company-admin-v2/people', icon: '◫', shortcut: 'G P', keywords: 'people teams عمال' },
  { id: 'chat', label: 'المحادثات المترجمة', href: '/messaging', icon: '◍', shortcut: 'G C', keywords: 'chat messages محادثات' },
  { id: 'billing', label: 'الفاتورة والاشتراك', href: '/company-admin/billing', icon: '₪', shortcut: 'G B', keywords: 'billing فاتورة' },
];

export const companyRoles: DsRole[] = [
  { id: 'owner', label: 'مالك المنصّة', href: '/super-admin-v2/dash' },
  { id: 'company', label: 'إدارة الشركة', href: '/company-admin-v2/dash' },
];

export const companyScreenTitles: Record<string, string> = {
  '/company-admin-v2/dash': 'وردية اليوم',
  '/company-admin-v2/approvals': 'الموافقات والطلبات',
  '/company-admin-v2/tasks': 'لوحة المهام',
  '/company-admin-v2/work-orders': 'أوامر العمل',
  '/company-admin-v2/attendance': 'الحضور والانصراف',
  '/company-admin-v2/people': 'العمال والفرق',
  '/company-admin-v2/roles': 'الأدوار والصلاحيات',
  '/company-admin-v2/training': 'التدريب والشهادات',
  '/company-admin-v2/assets': 'إدارة الأصول',
  '/company-admin-v2/fleet': 'إدارة الأسطول',
  '/company-admin-v2/visitors': 'إدارة الزوّار',
  '/company-admin-v2/compliance': 'الامتثال والسلامة',
  '/company-admin-v2/knowledge-base': 'قاعدة المعرفة',
  '/company-admin-v2/branding': 'العلامة التجارية',
};
