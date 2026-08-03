import { api } from '../api-client';
import type { CompanyOverviewReport, BillingOverviewReport, TranslationOverviewReport, PlatformOverviewReport } from '../types';

export const reportsApi = {
  companyOverview: (companyId: string) => api.get<CompanyOverviewReport>(`/companies/${companyId}/reports/overview`),
  billingOverview: (companyId: string) => api.get<BillingOverviewReport>(`/companies/${companyId}/reports/billing`),
  translationOverview: (companyId: string, days = 30) =>
    api.get<TranslationOverviewReport>(`/companies/${companyId}/reports/translation?days=${days}`),
  platformOverview: () => api.get<PlatformOverviewReport>('/reports/platform-overview'),
};
