import { api } from '../api-client';

export interface StorageSummary {
  platformTotalBytes: number;
  scopeNote: string;
  companyBreakdown: {
    companyId: string;
    companyName: string;
    totalBytes: number;
    messageAttachmentBytes: number;
    taskAttachmentBytes: number;
    fileCount: number;
  }[];
}

export const storageStatsApi = {
  getSummary: () => api.get<StorageSummary>('/platform-storage'),
};
