import { api } from '../api-client';

export interface TestAccount {
  id: string;
  label: string;
  email: string;
  phone: string | null;
  role: string;
  companyName: string | null;
}

export const testAccountsApi = {
  // Silently returns [] on any error (401 when disabled, network issues,
  // etc.) — the login page treats "no accounts" and "feature disabled"
  // identically: just don't show the panel.
  list: async (): Promise<TestAccount[]> => {
    try {
      return await api.get<TestAccount[]>('/auth/test-accounts', { skipAuth: true });
    } catch {
      return [];
    }
  },
};
