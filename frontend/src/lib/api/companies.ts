import { api } from '../api-client';
import type { Company, PlatformStats, CompanyDashboardStats } from '../types';

export const companiesApi = {
  listAll: () => api.get<{ items: Company[]; total: number }>('/companies'),

  platformStats: () => api.get<PlatformStats>('/companies/platform-stats'),

  platformAnalytics: () =>
    api.get<{
      mrrByMonth: { month: string; total: number }[];
      currentMonthMrr: number;
      mrrChangePercent: number | null;
      activeSubscriptionCount: number;
      cancelledLast30Days: number;
      needsAttention: { type: 'trial_ending' | 'renewing_soon'; companyId: string; companyName: string; date: string }[];
    }>('/companies/platform-analytics'),

  create: (data: {
    name: string;
    slug: string;
    industry?: string;
    defaultLanguage?: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
    // Sprint 4 (co_new wizard, steps 3-4) — optional, backward compatible.
    plan?: 'TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
    seats?: number;
    moduleCodes?: string[];
  }) => api.post<Company>('/companies', data),

  get: (companyId: string) => api.get<Company>(`/companies/${companyId}`),

  update: (
    companyId: string,
    data: Partial<
      Pick<
        Company,
        'name' | 'industry' | 'defaultLanguage' | 'isActive' | 'orgUnitLabelSingularEn' | 'orgUnitLabelPluralEn' | 'orgUnitLabelSingularAr' | 'orgUnitLabelPluralAr' | 'brandLogoUrl' | 'brandPrimaryHex'
      >
    >,
  ) => api.patch<Company>(`/companies/${companyId}`, data),

  dashboard: (companyId: string) => api.get<CompanyDashboardStats>(`/companies/${companyId}/dashboard`),

  // Sprint 6 (taxonomy screen)
  getIndustryPresets: () =>
    api.get<{ code: string; nameAr: string; levels: TaxonomyLevel[] }[]>('/companies/industry-presets'),

  getTaxonomy: (companyId: string) =>
    api.get<{ presetCode: string; levels: TaxonomyLevel[] }>(`/companies/${companyId}/taxonomy`),

  updateTaxonomy: (companyId: string, data: { presetCode?: string; levels?: TaxonomyLevel[] }) =>
    api.patch<{ presetCode: string; levels: TaxonomyLevel[] }>(`/companies/${companyId}/taxonomy`, data),
};

export interface TaxonomyLevel {
  key: string;
  labelSingularAr: string;
  labelPluralAr: string;
  labelSingularEn: string;
  labelPluralEn: string;
}
