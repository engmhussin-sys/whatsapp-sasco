import { ModuleCode } from '@prisma/client';

export interface ModuleCatalogEntry {
  code: ModuleCode;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  category: 'communication' | 'operations' | 'workforce' | 'assets' | 'compliance' | 'insights';
  /** Roadmap modules (sprints 5-10) appear in the catalog for product
   * visibility from Sprint 1 onward, but ModuleGuard never actually gates
   * anything with these codes yet — activating one today has no effect
   * beyond the marketplace UI showing it as active, until its sprint
   * ships the real functionality. */
  isComingSoon: boolean;
}

/**
 * Static, in-code catalog — not a DB table, because this is PLATFORM
 * metadata (every company sees the same catalog), while CompanyModule
 * is the per-company activation state. Deliberately not database-driven
 * yet: the catalog changes only when a developer ships a new module
 * (a code change either way), so a DB table here would just be an extra
 * migration for zero runtime flexibility.
 */
export const MODULE_CATALOG: ModuleCatalogEntry[] = [
  {
    code: ModuleCode.CHAT,
    nameAr: 'المحادثات',
    nameEn: 'Chat',
    descriptionAr: 'مراسلة فورية بترجمة تلقائية بين كل عامل ولغته',
    category: 'communication',
    isComingSoon: false,
  },
  {
    code: ModuleCode.BROADCAST,
    nameAr: 'الرسائل الجماعية',
    nameEn: 'Broadcast',
    descriptionAr: 'إعلانات وتنبيهات طوارئ لكل الشركة أو فئة مستهدَفة',
    category: 'communication',
    isComingSoon: false,
  },
  {
    code: ModuleCode.DIRECTORY,
    nameAr: 'دليل الشركة',
    nameEn: 'Company Directory',
    descriptionAr: 'بحث عن الزملاء عبر الفرق والأقسام',
    category: 'communication',
    isComingSoon: false,
  },
  {
    code: ModuleCode.TASKS,
    nameAr: 'المهام',
    nameEn: 'Tasks',
    descriptionAr: 'قوالب مهام قابلة للتخصيص، تكليف، ومتابعة الإنجاز',
    category: 'workforce',
    isComingSoon: false,
  },
  {
    code: ModuleCode.APPROVALS,
    nameAr: 'الموافقات',
    nameEn: 'Approvals',
    descriptionAr: 'مسارات موافقة متعددة الخطوات قابلة للتخصيص',
    category: 'workforce',
    isComingSoon: false,
  },
  {
    code: ModuleCode.SHIFTS,
    nameAr: 'الورديات',
    nameEn: 'Shift Management',
    descriptionAr: 'فتح وإغلاق سجلّات الورديات وتتبّعها',
    category: 'workforce',
    isComingSoon: false,
  },
  {
    code: ModuleCode.FUEL_REQUESTS,
    nameAr: 'طلبات الوقود',
    nameEn: 'Fuel Requests',
    descriptionAr: 'طلبات وقود بموافقة متعددة المستويات (سيصبح "أوامر عمل" عامة في سبرنت 5)',
    category: 'operations',
    isComingSoon: false,
  },
  {
    code: ModuleCode.SAFETY,
    nameAr: 'السلامة',
    nameEn: 'Safety',
    descriptionAr: 'بلاغات مخاطر وتنبيهات طوارئ فورية',
    category: 'compliance',
    isComingSoon: false,
  },
  {
    code: ModuleCode.REPORTS,
    nameAr: 'التقارير',
    nameEn: 'Reports',
    descriptionAr: 'تقارير تشغيلية ومالية على مستوى الشركة',
    category: 'insights',
    isComingSoon: false,
  },
  // ---- Roadmap (sprints 5-10) ----
  {
    code: ModuleCode.ATTENDANCE,
    nameAr: 'الحضور والانصراف',
    nameEn: 'Attendance & Time Tracking',
    descriptionAr: 'تسجيل حضور بموقع GPS وتتبّع ساعات العمل',
    category: 'workforce',
    isComingSoon: true,
  },
  {
    code: ModuleCode.ASSET_MANAGEMENT,
    nameAr: 'إدارة الأصول',
    nameEn: 'Asset & Inventory Management',
    descriptionAr: 'تتبّع الأصول والمخزون عبر كل المواقع',
    category: 'assets',
    isComingSoon: true,
  },
  {
    code: ModuleCode.FLEET_MANAGEMENT,
    nameAr: 'إدارة الأسطول',
    nameEn: 'Fleet Management',
    descriptionAr: 'تتبّع المركبات وصيانتها وجداول استخدامها',
    category: 'assets',
    isComingSoon: true,
  },
  {
    code: ModuleCode.VISITOR_MANAGEMENT,
    nameAr: 'إدارة الزوّار',
    nameEn: 'Visitor Management',
    descriptionAr: 'تسجيل دخول وخروج الزوّار وتصاريح الدخول',
    category: 'operations',
    isComingSoon: true,
  },
  {
    code: ModuleCode.TRAINING,
    nameAr: 'التدريب والشهادات',
    nameEn: 'Training & Certifications',
    descriptionAr: 'مسارات تدريب وتتبّع صلاحية الشهادات',
    category: 'compliance',
    isComingSoon: true,
  },
  {
    code: ModuleCode.COMPLIANCE,
    nameAr: 'الامتثال',
    nameEn: 'Compliance',
    descriptionAr: 'متابعة الالتزام بالمعايير التنظيمية',
    category: 'compliance',
    isComingSoon: true,
  },
  {
    code: ModuleCode.MAINTENANCE,
    nameAr: 'الصيانة',
    nameEn: 'Maintenance',
    descriptionAr: 'طلبات صيانة وجداول صيانة دورية للأصول والمواقع',
    category: 'operations',
    isComingSoon: true,
  },
  {
    code: ModuleCode.CRM,
    nameAr: 'إدارة علاقات العملاء',
    nameEn: 'CRM',
    descriptionAr: 'إدارة جهات اتصال وفرص تجارية',
    category: 'insights',
    isComingSoon: true,
  },
  {
    code: ModuleCode.FORM_BUILDER,
    nameAr: 'باني النماذج',
    nameEn: 'Dynamic Form Builder',
    descriptionAr: 'إنشاء نماذج مخصَّصة بالسحب والإفلات لأي غرض تشغيلي',
    category: 'operations',
    isComingSoon: true,
  },
];
