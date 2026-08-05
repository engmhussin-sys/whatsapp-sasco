import { api } from '../api-client';

export interface Visitor {
  id: string;
  fullName: string;
  phone?: string | null;
  purpose?: string | null;
  hostUser?: { id: string; firstName: string; lastName: string } | null;
  checkInAt: string;
  checkOutAt?: string | null;
  badgeNumber?: string | null;
}

export interface Certification {
  id: string;
  name: string;
  issuedAt: string;
  expiresAt?: string | null;
  user?: { id: string; firstName: string; lastName: string };
  computedStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY';
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description?: string | null;
  dueAt?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  assignedToUser?: { id: string; firstName: string; lastName: string } | null;
  isOverdue: boolean;
}

export const visitorsApi = {
  checkIn: (companyId: string, data: { fullName: string; phone?: string; purpose?: string; hostUserId?: string }) =>
    api.post<Visitor>(`/companies/${companyId}/visitors/check-in`, data),
  checkOut: (companyId: string, visitorId: string) => api.post<Visitor>(`/companies/${companyId}/visitors/${visitorId}/check-out`),
  onSite: (companyId: string) => api.get<Visitor[]>(`/companies/${companyId}/visitors/on-site`),
  today: (companyId: string) => api.get<Visitor[]>(`/companies/${companyId}/visitors/today`),
};

export const trainingApi = {
  create: (companyId: string, data: { userId: string; name: string; issuedAt: string; expiresAt?: string }) =>
    api.post<Certification>(`/companies/${companyId}/certifications`, data),
  listAll: (companyId: string) => api.get<Certification[]>(`/companies/${companyId}/certifications`),
};

export const complianceApi = {
  create: (companyId: string, data: { name: string; description?: string; dueAt?: string }) =>
    api.post<ComplianceRequirement>(`/companies/${companyId}/compliance`, data),
  list: (companyId: string) => api.get<ComplianceRequirement[]>(`/companies/${companyId}/compliance`),
  update: (companyId: string, id: string, data: { status?: string }) =>
    api.patch<ComplianceRequirement>(`/companies/${companyId}/compliance/${id}`, data),
};
