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

  /** الكتالوج الكامل — بصرف النظر عن أي شركة. للإدارة (تفعيل/تعطيل)،
   * وليس فقط العرض كما في listCompanyLanguages أعلاه. */
  listAll: () => api.get<Language[]>('/languages'),

  enable: (companyId: string, langCode: string) =>
    api.post<CompanyLanguage>(`/companies/${companyId}/languages`, { langCode }),

  disable: (companyId: string, langCode: string) =>
    api.delete<void>(`/companies/${companyId}/languages/${langCode}`),
};
