import { api } from '../api-client';

export interface AttendanceRecord {
  id: string;
  userId: string;
  checkInAt: string;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkOutAt?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  stationId?: string | null;
  user?: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
}

export const attendanceApi = {
  checkIn: (companyId: string, data: { latitude?: number; longitude?: number; stationId?: string }) =>
    api.post<AttendanceRecord>(`/companies/${companyId}/attendance/check-in`, data),

  checkOut: (companyId: string, data: { latitude?: number; longitude?: number }) =>
    api.post<AttendanceRecord>(`/companies/${companyId}/attendance/check-out`, data),

  myStatus: (companyId: string) =>
    api.get<{ checkedIn: boolean; record: AttendanceRecord | null }>(`/companies/${companyId}/attendance/me`),

  today: (companyId: string) => api.get<AttendanceRecord[]>(`/companies/${companyId}/attendance/today`),
};
