import { api } from '../api-client';

export interface BroadcastResult {
  conversationId: string;
  message: { id: string; originalText: string };
  recipientCount: number;
}

export type BroadcastTargetType = 'ALL' | 'ROLE' | 'STATION' | 'TEAM' | 'USER';

export interface SendBroadcastPayload {
  text: string;
  sourceLanguage: string;
  targetType: BroadcastTargetType;
  role?: string;
  stationId?: string;
  teamId?: string;
  userId?: string;
  urgent?: boolean;
}

export const broadcastApi = {
  send: (companyId: string, payload: SendBroadcastPayload) =>
    api.post<BroadcastResult>(`/companies/${companyId}/broadcast`, payload),
};
