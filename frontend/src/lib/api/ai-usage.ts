import { api } from '../api-client';

export interface AiUsageSummary {
  totalConsumedLast30Days: number;
  companyBreakdown: { companyId: string; companyName: string; currentBalance: number; consumedLast30Days: number }[];
}

export const aiUsageApi = {
  getSummary: () => api.get<AiUsageSummary>('/platform-ai-usage'),
};
