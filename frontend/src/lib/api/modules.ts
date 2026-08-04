import { api } from '../api-client';

export interface ModuleCatalogEntry {
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  category: 'communication' | 'operations' | 'workforce' | 'assets' | 'compliance' | 'insights';
  isComingSoon: boolean;
}

export interface CompanyModuleEntry extends ModuleCatalogEntry {
  isActive: boolean;
}

export interface EntitlementModuleEntry extends CompanyModuleEntry {
  includedInPlan: boolean;
}

export interface EntitlementSummary {
  plan: 'TRIAL' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  seatsLimit: number;
  seatPriceSar: number;
  monthlySeatCost: number;
  paidAddOnMonthlyCost: number;
  monthlyTotal: number;
  modules: EntitlementModuleEntry[];
}

export interface EntitlementChange {
  moduleCode: string;
  action: 'activate' | 'deactivate';
}

export interface EntitlementImpact {
  moduleCode: string;
  action: 'activate' | 'deactivate';
  monthlyPriceImpact: number | null;
  includedInPlan: boolean;
}

export const modulesApi = {
  getCatalog: () => api.get<ModuleCatalogEntry[]>('/modules/catalog'),

  getCompanyModules: (companyId: string) => api.get<CompanyModuleEntry[]>(`/companies/${companyId}/modules`),

  getEntitlementSummary: (companyId: string) => api.get<EntitlementSummary>(`/companies/${companyId}/entitlements`),

  previewEntitlementChanges: (companyId: string, changes: EntitlementChange[]) =>
    api.post<EntitlementImpact[]>(`/companies/${companyId}/entitlements/preview`, { changes }),

  applyEntitlementChanges: (companyId: string, changes: EntitlementChange[]) =>
    api.post<EntitlementImpact[]>(`/companies/${companyId}/entitlements/apply`, { changes }),
};
