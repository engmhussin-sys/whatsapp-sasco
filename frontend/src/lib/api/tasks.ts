import { api } from '../api-client';
import type { TaskItem, ApprovalItem, ShiftItem, ShiftLogItem, RecurringTaskSchedule } from '../types';

export interface TaskReportSummary {
  totalTasks: number;
  byStatus: Record<string, number>;
  completedCount: number;
  completionRate: number | null;
  overdueCount: number;
  overdueTasks: TaskItem[];
  byTeam: { teamId: string | null; teamName: string; total: number; completed: number; overdue: number }[];
  activeRecurringSchedules: number;
  generatedAt: string;
}

export const tasksApi = {
  list: (companyId: string, params?: { status?: string; assignedToUserId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.assignedToUserId) qs.set('assignedToUserId', params.assignedToUserId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<TaskItem[]>(`/companies/${companyId}/tasks${suffix}`);
  },

  get: (companyId: string, taskId: string) => api.get<TaskItem>(`/companies/${companyId}/tasks/${taskId}`),

  getReportSummary: (companyId: string) => api.get<TaskReportSummary>(`/companies/${companyId}/tasks/reports/summary`),

  /** يطابق CreateTaskDto على الخادم تماماً — templateId/teamId/assigneeIds
   * اختيارية كلها؛ بلا assigneeIds تُنشأ المهمة بحالة DRAFT بدل ASSIGNED. */
  create: (
    companyId: string,
    data: { title: string; description?: string; templateId?: string; teamId?: string; dueAt?: string; assigneeIds?: string[] },
  ) => api.post<TaskItem>(`/companies/${companyId}/tasks`, data),

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

export const recurringTaskSchedulesApi = {
  list: (companyId: string) => api.get<RecurringTaskSchedule[]>(`/companies/${companyId}/recurring-task-schedules`),

  get: (companyId: string, id: string) => api.get<RecurringTaskSchedule>(`/companies/${companyId}/recurring-task-schedules/${id}`),

  create: (
    companyId: string,
    data: {
      title: string;
      description?: string;
      templateId?: string;
      teamId?: string;
      assigneeIds: string[];
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      interval?: number;
      daysOfWeek?: number[];
      dayOfMonth?: number;
      timeOfDay: string;
      startDate: string;
      endDate?: string;
    },
  ) => api.post<RecurringTaskSchedule>(`/companies/${companyId}/recurring-task-schedules`, data),

  update: (companyId: string, id: string, data: { isActive?: boolean; endDate?: string }) =>
    api.patch<RecurringTaskSchedule>(`/companies/${companyId}/recurring-task-schedules/${id}`, data),
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
