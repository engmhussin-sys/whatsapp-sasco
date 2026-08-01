import { api } from '../api-client';
import type { Conversation, Message } from '../types';

export const conversationsApi = {
  list: (companyId: string) => api.get<Conversation[]>(`/companies/${companyId}/conversations`),

  get: (companyId: string, conversationId: string) =>
    api.get<Conversation>(`/companies/${companyId}/conversations/${conversationId}`),

  create: (companyId: string, data: { type: 'DIRECT' | 'GROUP' | 'TEAM'; memberIds: string[]; title?: string; teamId?: string }) =>
    api.post<Conversation>(`/companies/${companyId}/conversations`, data),
};

export const messagesApi = {
  list: (companyId: string, conversationId: string, cursor?: string) =>
    api.get<Message[]>(
      `/companies/${companyId}/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`,
    ),

  sendText: (companyId: string, conversationId: string, text: string) =>
    api.post<Message>(`/companies/${companyId}/conversations/${conversationId}/messages/text`, { text }),

  sendVoice: (companyId: string, conversationId: string, audioBlob: Blob, durationMs?: number) => {
    const form = new FormData();
    form.append('audio', audioBlob, 'voice-message.webm');
    if (durationMs) form.append('durationMs', String(durationMs));
    return api.post<Message>(`/companies/${companyId}/conversations/${conversationId}/messages/voice`, form);
  },

  markRead: (companyId: string, conversationId: string, upToMessageId?: string) =>
    api.post(`/companies/${companyId}/conversations/${conversationId}/messages/read`, { upToMessageId }),
};
