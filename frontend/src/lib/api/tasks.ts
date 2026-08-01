import { api } from '../api-client';
import type { TaskItem, ApprovalItem, ShiftItem, ShiftLogItem } from '../types';

export const tasksApi = {
  list: (companyId: string, params?: { status?: string; assignedToUserId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.assignedToUserId) qs.set('assignedToUserId', params.assignedToUserId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<TaskItem[]>(`/companies/${companyId}/tasks${suffix}`);
  },

  get: (companyId: string, taskId: string) => api.get<TaskItem>(`/companies/${companyId}/tasks/${taskId}`),

  submitResponse: (companyId: string, taskId: string, answers: Record<string, unknown>) =>
    api.post(`/companies/${companyId}/tasks/${taskId}/responses`, { answers }),

  uploadAttachment: (companyId: string, responseId: string, file: File, fieldId: string, kind: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fieldId', fieldId);
    form.append('kind', kind);
    return api.post(`/companies/${companyId}/tasks/responses/${responseId}/attachments`, form);
  },
};

export const approvalsApi = {
  listMine: (companyId: string) => api.get<ApprovalItem[]>(`/companies/${companyId}/approvals?mine=true`),

  get: (companyId: string, approvalId: string) => api.get<ApprovalItem>(`/companies/${companyId}/approvals/${approvalId}`),

  act: (companyId: string, approvalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN' | 'COMMENT', comment?: string) =>
    api.post(`/companies/${companyId}/approvals/${approvalId}/actions`, { action, comment }),
};

export const shiftsApi = {
  list: (companyId: string) => api.get<ShiftItem[]>(`/companies/${companyId}/shifts`),

  myLogs: (companyId: string) => api.get<ShiftLogItem[]>(`/companies/${companyId}/shift-logs/mine`),

  open: (companyId: string, data: { shiftId: string; stationId?: string; openTaskTemplateId?: string; openAnswers?: Record<string, unknown> }) =>
    api.post<ShiftLogItem>(`/companies/${companyId}/shift-logs/open`, data),

  close: (companyId: string, shiftLogId: string, data?: { closeTaskTemplateId?: string; closeAnswers?: Record<string, unknown> }) =>
    api.post<ShiftLogItem>(`/companies/${companyId}/shift-logs/${shiftLogId}/close`, data ?? {}),
};
