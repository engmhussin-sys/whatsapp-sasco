import { api } from '../api-client';

export type KnowledgeArticleCategory = 'GETTING_STARTED' | 'MODULES' | 'BILLING' | 'TROUBLESHOOTING' | 'OTHER';

export interface KnowledgeArticle {
  id: string;
  companyId: string | null;
  title: string;
  body: string;
  category: KnowledgeArticleCategory;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export const knowledgeBaseApi = {
  listForCompany: (companyId: string, includeDrafts = false) =>
    api.get<KnowledgeArticle[]>(`/companies/${companyId}/knowledge-base${includeDrafts ? '?includeDrafts=true' : ''}`),

  createCompanyArticle: (companyId: string, data: { title: string; body: string; category?: KnowledgeArticleCategory; isPublished?: boolean }) =>
    api.post<KnowledgeArticle>(`/companies/${companyId}/knowledge-base`, data),

  update: (articleId: string, data: Partial<{ title: string; body: string; category: KnowledgeArticleCategory; isPublished: boolean }>) =>
    api.patch<KnowledgeArticle>(`/knowledge-base/${articleId}`, data),

  remove: (articleId: string) => api.delete(`/knowledge-base/${articleId}`),
};
