export interface TaxonomyLevel {
  key: string; // neutral core key — never changes, never shown to the user
  labelSingularAr: string;
  labelPluralAr: string;
  labelSingularEn: string;
  labelPluralEn: string;
}

export interface TaxonomyPreset {
  code: string;
  nameAr: string;
  levels: TaxonomyLevel[];
}

/**
 * Sprint 6 — matches the design spec's "قاعدة النواة" exactly: every
 * preset uses the SAME 7 neutral core keys (organization, branch, site,
 * department, team, shift, person) in the SAME order. Only the LABELS
 * change per sector — never the underlying key, since nothing in the
 * database schema is renamed by this system (see Company.orgTaxonomy's
 * own doc comment in schema.prisma).
 */
export const TAXONOMY_PRESETS: TaxonomyPreset[] = [
  {
    code: 'fuel',
    nameAr: 'وقود ومحطات',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'منطقة', labelPluralAr: 'مناطق', labelSingularEn: 'Region', labelPluralEn: 'Regions' },
      { key: 'site', labelSingularAr: 'محطة', labelPluralAr: 'محطات', labelSingularEn: 'Station', labelPluralEn: 'Stations' },
      { key: 'department', labelSingularAr: 'قسم', labelPluralAr: 'أقسام', labelSingularEn: 'Department', labelPluralEn: 'Departments' },
      { key: 'team', labelSingularAr: 'فريق', labelPluralAr: 'فرق', labelSingularEn: 'Team', labelPluralEn: 'Teams' },
      { key: 'shift', labelSingularAr: 'وردية', labelPluralAr: 'ورديات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'عامل', labelPluralAr: 'عمّال', labelSingularEn: 'Worker', labelPluralEn: 'Workers' },
    ],
  },
  {
    code: 'healthcare',
    nameAr: 'رعاية صحية',
    levels: [
      { key: 'organization', labelSingularAr: 'المجموعة الطبية', labelPluralAr: 'المجموعات الطبية', labelSingularEn: 'Healthcare Group', labelPluralEn: 'Healthcare Groups' },
      { key: 'branch', labelSingularAr: 'منطقة', labelPluralAr: 'مناطق', labelSingularEn: 'Region', labelPluralEn: 'Regions' },
      { key: 'site', labelSingularAr: 'مستشفى', labelPluralAr: 'مستشفيات', labelSingularEn: 'Hospital', labelPluralEn: 'Hospitals' },
      { key: 'department', labelSingularAr: 'عيادة', labelPluralAr: 'عيادات', labelSingularEn: 'Clinic', labelPluralEn: 'Clinics' },
      { key: 'team', labelSingularAr: 'فريق طبي', labelPluralAr: 'فرق طبية', labelSingularEn: 'Medical Team', labelPluralEn: 'Medical Teams' },
      { key: 'shift', labelSingularAr: 'مناوبة', labelPluralAr: 'مناوبات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'موظف طبي', labelPluralAr: 'موظفون طبيون', labelSingularEn: 'Staff', labelPluralEn: 'Staff' },
    ],
  },
  {
    code: 'construction',
    nameAr: 'إنشاءات',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'قطاع', labelPluralAr: 'قطاعات', labelSingularEn: 'Division', labelPluralEn: 'Divisions' },
      { key: 'site', labelSingularAr: 'مشروع', labelPluralAr: 'مشاريع', labelSingularEn: 'Project', labelPluralEn: 'Projects' },
      { key: 'department', labelSingularAr: 'موقع', labelPluralAr: 'مواقع', labelSingularEn: 'Site', labelPluralEn: 'Sites' },
      { key: 'team', labelSingularAr: 'طاقم', labelPluralAr: 'طواقم', labelSingularEn: 'Crew', labelPluralEn: 'Crews' },
      { key: 'shift', labelSingularAr: 'وردية', labelPluralAr: 'ورديات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'عامل', labelPluralAr: 'عمّال', labelSingularEn: 'Laborer', labelPluralEn: 'Laborers' },
    ],
  },
  {
    code: 'transport',
    nameAr: 'نقل ولوجستيات',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'أسطول', labelPluralAr: 'أساطيل', labelSingularEn: 'Fleet', labelPluralEn: 'Fleets' },
      { key: 'site', labelSingularAr: 'مستودع', labelPluralAr: 'مستودعات', labelSingularEn: 'Depot', labelPluralEn: 'Depots' },
      { key: 'department', labelSingularAr: 'خط', labelPluralAr: 'خطوط', labelSingularEn: 'Route', labelPluralEn: 'Routes' },
      { key: 'team', labelSingularAr: 'فريق', labelPluralAr: 'فرق', labelSingularEn: 'Team', labelPluralEn: 'Teams' },
      { key: 'shift', labelSingularAr: 'رحلة', labelPluralAr: 'رحلات', labelSingularEn: 'Trip', labelPluralEn: 'Trips' },
      { key: 'person', labelSingularAr: 'سائق', labelPluralAr: 'سائقون', labelSingularEn: 'Driver', labelPluralEn: 'Drivers' },
    ],
  },
  {
    code: 'manufacturing',
    nameAr: 'تصنيع',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'قطاع', labelPluralAr: 'قطاعات', labelSingularEn: 'Division', labelPluralEn: 'Divisions' },
      { key: 'site', labelSingularAr: 'مصنع', labelPluralAr: 'مصانع', labelSingularEn: 'Plant', labelPluralEn: 'Plants' },
      { key: 'department', labelSingularAr: 'خط إنتاج', labelPluralAr: 'خطوط إنتاج', labelSingularEn: 'Production Line', labelPluralEn: 'Production Lines' },
      { key: 'team', labelSingularAr: 'فريق', labelPluralAr: 'فرق', labelSingularEn: 'Team', labelPluralEn: 'Teams' },
      { key: 'shift', labelSingularAr: 'وردية', labelPluralAr: 'ورديات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'عامل', labelPluralAr: 'عمّال', labelSingularEn: 'Operator', labelPluralEn: 'Operators' },
    ],
  },
  {
    code: 'retail',
    nameAr: 'تجزئة',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'منطقة', labelPluralAr: 'مناطق', labelSingularEn: 'Region', labelPluralEn: 'Regions' },
      { key: 'site', labelSingularAr: 'متجر', labelPluralAr: 'متاجر', labelSingularEn: 'Store', labelPluralEn: 'Stores' },
      { key: 'department', labelSingularAr: 'قسم', labelPluralAr: 'أقسام', labelSingularEn: 'Department', labelPluralEn: 'Departments' },
      { key: 'team', labelSingularAr: 'فريق', labelPluralAr: 'فرق', labelSingularEn: 'Team', labelPluralEn: 'Teams' },
      { key: 'shift', labelSingularAr: 'وردية', labelPluralAr: 'ورديات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'موظف مبيعات', labelPluralAr: 'موظفو مبيعات', labelSingularEn: 'Associate', labelPluralEn: 'Associates' },
    ],
  },
  {
    code: 'facilities',
    nameAr: 'مرافق ومطارات وموانئ',
    levels: [
      { key: 'organization', labelSingularAr: 'الشركة', labelPluralAr: 'الشركات', labelSingularEn: 'Company', labelPluralEn: 'Companies' },
      { key: 'branch', labelSingularAr: 'منطقة', labelPluralAr: 'مناطق', labelSingularEn: 'Region', labelPluralEn: 'Regions' },
      { key: 'site', labelSingularAr: 'منشأة', labelPluralAr: 'منشآت', labelSingularEn: 'Facility', labelPluralEn: 'Facilities' },
      { key: 'department', labelSingularAr: 'صالة', labelPluralAr: 'صالات', labelSingularEn: 'Terminal', labelPluralEn: 'Terminals' },
      { key: 'team', labelSingularAr: 'فريق', labelPluralAr: 'فرق', labelSingularEn: 'Team', labelPluralEn: 'Teams' },
      { key: 'shift', labelSingularAr: 'وردية', labelPluralAr: 'ورديات', labelSingularEn: 'Shift', labelPluralEn: 'Shifts' },
      { key: 'person', labelSingularAr: 'موظف', labelPluralAr: 'موظفون', labelSingularEn: 'Staff', labelPluralEn: 'Staff' },
    ],
  },
];

export function getPresetByCode(code: string): TaxonomyPreset | undefined {
  return TAXONOMY_PRESETS.find((p) => p.code === code);
}
