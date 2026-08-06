export interface SectorTaskSeed {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
}

export interface SectorContent {
  code: 'FUEL_STATION' | 'HOSPITAL' | 'CONSTRUCTION' | 'FACTORY';
  nameAr: string;
  nameEn: string;
  /** Matches this sector's org-level naming from Sprint 6's taxonomy
   * presets — kept in sync deliberately (see taxonomy-presets.data.ts)
   * rather than defining a second, possibly-conflicting naming scheme. */
  siteLabelAr: string;
  groupLabelAr: string;
  jobTitleAr: string;
  tasks: SectorTaskSeed[];
  // icon: اسم أيقونة Material نصي (مثل 'construction') — يُترجَم
  // لأيقونة فعلية في الموبايل، وليس إيموجي (يظهر بشكل مختلف بين
  // الأجهزة، لا يقبل التلوين، ويقرأ كمحتوى مستخدم لا واجهة نظام).
  ppeItems: { labelAr: string; icon: string }[];
  hazardKinds: string[]; // subset of the HazardKind enum relevant to this sector
  dailySafetyAlertAr: string;
}

export const SECTOR_CONTENT: SectorContent[] = [
  {
    code: 'FUEL_STATION',
    nameAr: 'محطات وقود',
    nameEn: 'Fuel Stations',
    siteLabelAr: 'محطة',
    groupLabelAr: 'فريق',
    jobTitleAr: 'عامل محطة',
    tasks: [
      { nameAr: 'فحص الخزانات اليومي', nameEn: 'Daily Tank Inspection', descriptionAr: 'قياس مستوى الوقود والتحقّق من عدم وجود تسريب في كل خزان بداية الوردية' },
      { nameAr: 'فحص طفايات الحريق', nameEn: 'Fire Extinguisher Check', descriptionAr: 'التأكد من صلاحية وضغط كل طفاية حريق في الموقع' },
      { nameAr: 'تنظيف منطقة المضخات', nameEn: 'Pump Area Cleaning', descriptionAr: 'إزالة أي بقع وقود وتنظيف الأرضية حول المضخات' },
      { nameAr: 'تسليم الوردية', nameEn: 'Shift Handover', descriptionAr: 'تسجيل قراءات الخزانات والمبالغ النقدية وتسليمها للوردية التالية' },
    ],
    ppeItems: [
      { labelAr: 'قفازات مقاومة للوقود', icon: 'back_hand_outlined' },
      { labelAr: 'حذاء أمان مضاد للانزلاق', icon: 'hiking' },
      { labelAr: 'نظارة واقية', icon: 'remove_red_eye_outlined' },
      { labelAr: 'سترة عاكسة', icon: 'safety_divider' },
    ],
    hazardKinds: ['FUEL_LEAK', 'FIRE_SMOKE', 'SLIPPERY_FLOOR', 'ELECTRICAL'],
    dailySafetyAlertAr: 'تذكير: لا تستخدم الهاتف المحمول بالقرب من المضخات — خطر اشتعال حقيقي',
  },
  {
    code: 'HOSPITAL',
    nameAr: 'مستشفيات',
    nameEn: 'Hospitals',
    siteLabelAr: 'مستشفى',
    groupLabelAr: 'فريق طبي',
    jobTitleAr: 'موظف طبي',
    tasks: [
      { nameAr: 'جولة فحص الأجنحة', nameEn: 'Ward Rounds Check', descriptionAr: 'التأكد من سلامة تجهيزات كل جناح ونظافته بداية الوردية' },
      { nameAr: 'التخلّص من النفايات الطبية', nameEn: 'Medical Waste Disposal', descriptionAr: 'فرز وإخراج النفايات الطبية الخطرة وفق البروتوكول المعتمد' },
      { nameAr: 'تعقيم غرف العمليات', nameEn: 'OR Sterilization', descriptionAr: 'تعقيم الأدوات والأسطح قبل كل عملية' },
      { nameAr: 'تسليم الوردية الطبية', nameEn: 'Clinical Shift Handover', descriptionAr: 'تسليم حالات المرضى والملاحظات الحرجة للوردية التالية' },
    ],
    ppeItems: [
      { labelAr: 'قفازات معقَّمة', icon: 'back_hand_outlined' },
      { labelAr: 'كمّامة طبية', icon: 'masks_outlined' },
      { labelAr: 'مريلة واقية', icon: 'checkroom_outlined' },
      { labelAr: 'واقي وجه', icon: 'shield_outlined' },
    ],
    hazardKinds: ['MEDICAL_WASTE', 'ELECTRICAL', 'SLIPPERY_FLOOR', 'FIRE_SMOKE'],
    dailySafetyAlertAr: 'تذكير: تخلَّص من الإبر والأدوات الحادة في الحاوية المخصَّصة فقط',
  },
  {
    code: 'CONSTRUCTION',
    nameAr: 'مقاولات',
    nameEn: 'Construction',
    siteLabelAr: 'موقع',
    groupLabelAr: 'طاقم',
    jobTitleAr: 'عامل موقع',
    tasks: [
      { nameAr: 'فحص السقالات', nameEn: 'Scaffold Inspection', descriptionAr: 'التأكد من ثبات وسلامة كل سقالة قبل بدء العمل عليها' },
      { nameAr: 'فحص معدات الرفع', nameEn: 'Lifting Equipment Check', descriptionAr: 'فحص الأوناش والحبال والسلاسل قبل الاستخدام' },
      { nameAr: 'تأمين محيط الحفر', nameEn: 'Excavation Perimeter Safety', descriptionAr: 'وضع الحواجز واللافتات حول أي حفرة أو منطقة خطرة' },
      { nameAr: 'تقرير نهاية اليوم', nameEn: 'End of Day Report', descriptionAr: 'توثيق التقدّم والحوادث والمواد المُستخدَمة' },
    ],
    ppeItems: [
      { labelAr: 'خوذة أمان', icon: 'construction' },
      { labelAr: 'حزام أمان للارتفاعات', icon: 'link' },
      { labelAr: 'حذاء بمقدمة فولاذية', icon: 'hiking' },
      { labelAr: 'سترة عاكسة', icon: 'safety_divider' },
    ],
    hazardKinds: ['UNSAFE_SCAFFOLD', 'ELECTRICAL', 'SLIPPERY_FLOOR', 'FIRE_SMOKE'],
    dailySafetyAlertAr: 'تذكير: لا تعمل على أي سقالة لم تُفحَص وتُختَم اليوم',
  },
  {
    code: 'FACTORY',
    nameAr: 'مصانع',
    nameEn: 'Factories',
    siteLabelAr: 'مصنع',
    groupLabelAr: 'فريق إنتاج',
    jobTitleAr: 'مشغّل خط إنتاج',
    tasks: [
      { nameAr: 'فحص خط الإنتاج', nameEn: 'Production Line Check', descriptionAr: 'التأكد من سلامة تشغيل كل محطة على الخط قبل بدء التشغيل' },
      { nameAr: 'فحص أغطية الآلات الواقية', nameEn: 'Machine Guard Check', descriptionAr: 'التأكد من تركيب كل غطاء وقائي على الأجزاء المتحرّكة' },
      { nameAr: 'فحص جودة الدُفعة', nameEn: 'Batch Quality Check', descriptionAr: 'أخذ عيّنة وفحصها وفق معايير الجودة المعتمدة' },
      { nameAr: 'تقرير نهاية الوردية', nameEn: 'End of Shift Report', descriptionAr: 'تسجيل الكمية المُنتَجة والأعطال والمواد المُستهلَكة' },
    ],
    ppeItems: [
      { labelAr: 'واقي سمع', icon: 'headset_outlined' },
      { labelAr: 'نظارة واقية', icon: 'remove_red_eye_outlined' },
      { labelAr: 'قفازات مقاومة للقطع', icon: 'back_hand_outlined' },
      { labelAr: 'حذاء بمقدمة فولاذية', icon: 'hiking' },
    ],
    hazardKinds: ['UNGUARDED_MACHINE', 'ELECTRICAL', 'FIRE_SMOKE', 'SLIPPERY_FLOOR'],
    dailySafetyAlertAr: 'تذكير: لا تُشغِّل أي آلة بغطائها الواقي مرفوعًا أو مفقودًا',
  },
];

export function getSectorContent(code: string): SectorContent | undefined {
  return SECTOR_CONTENT.find((s) => s.code === code);
}
