import { api } from '../api-client';

export interface LoginSession {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  expiresAt: string;
  user: { id: string; firstName: string; lastName: string; email: string | null; companyId: string | null };
}

export const securitySessionsApi = {
  listActive: () => api.get<LoginSession[]>('/security/sessions'),
  revoke: (sessionId: string) => api.patch(`/security/sessions/${sessionId}/revoke`),
};
