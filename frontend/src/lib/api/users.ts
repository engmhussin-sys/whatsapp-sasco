import { api } from '../api-client';
import type { AppUser, Team, RoleDef } from '../types';

export const usersApi = {
  list: (companyId: string, search?: string) =>
    api.get<{ items: AppUser[]; total: number }>(
      `/companies/${companyId}/users${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),

  create: (
    companyId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      systemRole?: string;
      preferredLanguage?: string;
    },
  ) => api.post<AppUser>(`/companies/${companyId}/users`, data),

  update: (companyId: string, userId: string, data: Partial<{ isActive: boolean; firstName: string; lastName: string }>) =>
    api.patch<AppUser>(`/companies/${companyId}/users/${userId}`, data),
};

export const teamsApi = {
  list: (companyId: string) => api.get<Team[]>(`/companies/${companyId}/teams`),

  create: (companyId: string, data: { name: string; description?: string }) =>
    api.post<Team>(`/companies/${companyId}/teams`, data),

  addMember: (companyId: string, teamId: string, userId: string, isLead = false) =>
    api.post(`/companies/${companyId}/teams/${teamId}/members`, { userId, isLead }),
};

export const rolesApi = {
  list: (companyId: string) => api.get<RoleDef[]>(`/companies/${companyId}/roles`),

  create: (companyId: string, data: { name: string; description?: string; permissionCodes?: string[] }) =>
    api.post<RoleDef>(`/companies/${companyId}/roles`, data),

  assign: (companyId: string, userId: string, roleId: string) =>
    api.post(`/companies/${companyId}/roles/assign`, { userId, roleId }),
};
