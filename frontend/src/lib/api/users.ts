import { api } from '../api-client';
import type { AppUser, Team, RoleDef, PermissionDef } from '../types';

export const usersApi = {
  list: (companyId: string, params?: { search?: string; stationId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.stationId) qs.set('stationId', params.stationId);
    const query = qs.toString();
    return api.get<{ items: AppUser[]; total: number }>(`/companies/${companyId}/users${query ? `?${query}` : ''}`);
  },

  create: (
    companyId: string,
    data: {
      email?: string;
      phone?: string;
      password?: string;
      firstName: string;
      lastName: string;
      systemRole?: string;
      preferredLanguage?: string;
      primaryStationId?: string;
    },
  ) => api.post<AppUser>(`/companies/${companyId}/users`, data),

  update: (
    companyId: string,
    userId: string,
    data: Partial<{ isActive: boolean; firstName: string; lastName: string; password: string; systemRole: string; primaryStationId: string | null }>,
  ) => api.patch<AppUser>(`/companies/${companyId}/users/${userId}`, data),
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

  setPermissions: (companyId: string, roleId: string, permissionCodes: string[]) =>
    api.patch<RoleDef>(`/companies/${companyId}/roles/${roleId}/permissions`, { permissionCodes }),

  listAllPermissions: (companyId: string) => api.get<PermissionDef[]>(`/companies/${companyId}/roles/permissions/catalog`),
};
