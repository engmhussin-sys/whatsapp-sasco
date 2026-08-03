import { api } from '../api-client';

export interface TicketMessageEntry {
  id: string;
  body: string;
  createdAt: string;
  author: { firstName: string; lastName: string; systemRole?: string };
}

export interface TicketSummary {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  company?: { name: string } | null;
  createdBy?: { firstName: string; lastName: string };
  _count?: { messages: number };
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessageEntry[];
}

export const supportTicketsApi = {
  create: (companyId: string, subject: string, body: string, priority?: string) =>
    api.post<TicketDetail>(`/companies/${companyId}/support-tickets`, { subject, body, priority }),
  listForCompany: (companyId: string) => api.get<TicketSummary[]>(`/companies/${companyId}/support-tickets`),
  getForCompany: (companyId: string, ticketId: string) => api.get<TicketDetail>(`/companies/${companyId}/support-tickets/${ticketId}`),
  addMessageAsCompany: (companyId: string, ticketId: string, body: string) =>
    api.post<TicketMessageEntry>(`/companies/${companyId}/support-tickets/${ticketId}/messages`, { body }),

  listAllPlatform: (status?: string) => api.get<TicketSummary[]>(`/support-tickets${status ? `?status=${status}` : ''}`),
  getPlatform: (ticketId: string) => api.get<TicketDetail>(`/support-tickets/${ticketId}`),
  addMessageAsPlatform: (ticketId: string, body: string) => api.post<TicketMessageEntry>(`/support-tickets/${ticketId}/messages`, { body }),
  updateStatus: (ticketId: string, status: string) => api.patch<TicketSummary>(`/support-tickets/${ticketId}/status`, { status }),
};
