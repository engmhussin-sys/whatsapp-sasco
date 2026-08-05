import { api } from '../api-client';

export type AssetStatus = 'ACTIVE' | 'IN_MAINTENANCE' | 'RETIRED';

export interface Asset {
  id: string;
  name: string;
  category?: string | null;
  serialNumber?: string | null;
  status: AssetStatus;
  assignedToUser?: { id: string; firstName: string; lastName: string } | null;
  purchasedAt?: string | null;
  valueSar?: string | null;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  status: AssetStatus;
  assignedToUser?: { id: string; firstName: string; lastName: string } | null;
  lastMaintenanceAt?: string | null;
  nextMaintenanceAt?: string | null;
  createdAt: string;
}

export const assetsApi = {
  list: (companyId: string) => api.get<Asset[]>(`/companies/${companyId}/assets`),
  create: (companyId: string, data: { name: string; category?: string; serialNumber?: string }) =>
    api.post<Asset>(`/companies/${companyId}/assets`, data),
  update: (companyId: string, assetId: string, data: Partial<{ status: AssetStatus; notes: string }>) =>
    api.patch<Asset>(`/companies/${companyId}/assets/${assetId}`, data),
};

export const vehiclesApi = {
  list: (companyId: string) => api.get<Vehicle[]>(`/companies/${companyId}/vehicles`),
  create: (companyId: string, data: { plateNumber: string; make?: string; model?: string; year?: number }) =>
    api.post<Vehicle>(`/companies/${companyId}/vehicles`, data),
  dueForMaintenance: (companyId: string) => api.get<Vehicle[]>(`/companies/${companyId}/vehicles/due-maintenance`),
};
