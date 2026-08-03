import { api } from '../api-client';

export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { skip?: number; take?: number; unreadOnly?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.skip) qs.set('skip', String(params.skip));
    if (params?.take) qs.set('take', String(params.take));
    if (params?.unreadOnly) qs.set('unreadOnly', 'true');
    const suffix = qs.toString() ? `?${qs}` : '';
    return api.get<{ items: NotificationEntry[]; total: number }>(`/notifications${suffix}`);
  },
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markAsRead: (id: string) => api.post<NotificationEntry>(`/notifications/${id}/read`, {}),
  markAllAsRead: () => api.post<{ success: boolean }>('/notifications/read-all', {}),
};
