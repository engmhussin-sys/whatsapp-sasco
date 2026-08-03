import { api } from '../api-client';

export interface BroadcastResult {
  conversationId: string;
  message: { id: string; originalText: string };
  recipientCount: number;
}

export const broadcastApi = {
  send: (companyId: string, text: string, sourceLanguage: string, urgent = false) =>
    api.post<BroadcastResult>(`/companies/${companyId}/broadcast`, { text, sourceLanguage, urgent }),
};
