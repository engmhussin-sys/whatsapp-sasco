import { api } from '../api-client';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isRtl: boolean;
  isActive: boolean;
}

export interface CompanyLanguage {
  companyId: string;
  langCode: string;
  language: Language;
}

export const languagesApi = {
  listCompanyLanguages: (companyId: string) => api.get<CompanyLanguage[]>(`/companies/${companyId}/languages`),
};
