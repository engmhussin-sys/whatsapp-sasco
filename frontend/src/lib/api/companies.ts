import { api } from '../api-client';
import type { Company, PlatformStats, CompanyDashboardStats } from '../types';

export const companiesApi = {
  listAll: () => api.get<{ items: Company[]; total: number }>('/companies'),

  platformStats: () => api.get<PlatformStats>('/companies/platform-stats'),

  create: (data: {
    name: string;
    slug: string;
    industry?: string;
    defaultLanguage?: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) => api.post<Company>('/companies', data),

  get: (companyId: string) => api.get<Company>(`/companies/${companyId}`),

  dashboard: (companyId: string) => api.get<CompanyDashboardStats>(`/companies/${companyId}/dashboard`),
};
