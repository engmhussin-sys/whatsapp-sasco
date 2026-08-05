import { api } from '../api-client';

export interface SystemHealthSnapshot {
  measuredAt: string;
  apiUptimeSeconds: number;
  database: { healthy: boolean; latencyMs: number | null };
  memory: { rssMb: number; heapUsedMb: number };
  recentActivity24h: number;
}

export const systemHealthApi = {
  getSnapshot: () => api.get<SystemHealthSnapshot>('/system-health'),
};
