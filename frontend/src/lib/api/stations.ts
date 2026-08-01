import { api } from '../api-client';

export interface Tank {
  id: string;
  code: string;
  fuelType: string;
  capacityLiters: number;
  lastKnownLevel: number | null;
}

export interface Station {
  id: string;
  name: string;
  code: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  tanks: Tank[];
}

export const stationsApi = {
  list: (companyId: string) => api.get<Station[]>(`/companies/${companyId}/stations`),

  get: (companyId: string, stationId: string) => api.get<Station>(`/companies/${companyId}/stations/${stationId}`),

  create: (companyId: string, data: { name: string; code: string; latitude?: number; longitude?: number }) =>
    api.post<Station>(`/companies/${companyId}/stations`, data),

  addTank: (companyId: string, stationId: string, data: { code: string; fuelType: string; capacityLiters: number }) =>
    api.post<Tank>(`/companies/${companyId}/stations/${stationId}/tanks`, data),

  updateTankLevel: (companyId: string, tankId: string, level: number) =>
    api.patch<Tank>(`/companies/${companyId}/stations/tanks/${tankId}/level`, { level }),
};
