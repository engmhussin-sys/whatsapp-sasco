import { api } from '../api-client';
import type { AuditLogEntry } from '../types';

export const auditLogsApi = {
  listForCompany: (companyId: string, params?: { skip?: number; take?: number; entityType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.take) qs.set('take', String(params.take));
    if (params?.entityType) qs.set('entityType', params.entityType);
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<{ items: AuditLogEntry[]; total: number }>(`/companies/${companyId}/audit-logs${suffix}`);
  },
  listPlatform: (params?: { skip?: number; take?: number; entityType?: string; action?: string }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.take) qs.set('take', String(params.take));
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.action) qs.set('action', params.action);
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<{ items: AuditLogEntry[]; total: number }>(`/audit-logs${suffix}`);
  },
};
