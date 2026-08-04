import { api } from '../api-client';

export type TaskFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'TIME'
  | 'PHOTO'
  | 'VIDEO'
  | 'AUDIO'
  | 'SIGNATURE'
  | 'GPS'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'BARCODE'
  | 'QR'
  | 'RADIO'
  | 'RATING'
  | 'FILE_UPLOAD';

export interface FieldConditionalLogic {
  dependsOnFieldId: string;
  showWhenEquals: string;
}

export interface FieldValidationRule {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface TaskFieldDefinition {
  id: string;
  type: TaskFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  conditionalLogic?: FieldConditionalLogic;
  validation?: FieldValidationRule;
}

export interface TaskTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  domainTag?: string | null;
  fields: TaskFieldDefinition[];
  approvalFlowId?: string | null;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplateVersion {
  id: string;
  version: number;
  name: string;
  description?: string | null;
  fields: TaskFieldDefinition[];
  createdAt: string;
}

export const taskTemplatesApi = {
  list: (companyId: string) => api.get<TaskTemplate[]>(`/companies/${companyId}/task-templates`),

  get: (companyId: string, templateId: string) =>
    api.get<TaskTemplate>(`/companies/${companyId}/task-templates/${templateId}`),

  create: (companyId: string, data: { name: string; description?: string; domainTag?: string; fields: TaskFieldDefinition[] }) =>
    api.post<TaskTemplate>(`/companies/${companyId}/task-templates`, data),

  update: (
    companyId: string,
    templateId: string,
    data: Partial<{ name: string; description: string; domainTag: string; fields: TaskFieldDefinition[]; isActive: boolean }>,
  ) => api.patch<TaskTemplate>(`/companies/${companyId}/task-templates/${templateId}`, data),

  getVersions: (companyId: string, templateId: string) =>
    api.get<TaskTemplateVersion[]>(`/companies/${companyId}/task-templates/${templateId}/versions`),
};
