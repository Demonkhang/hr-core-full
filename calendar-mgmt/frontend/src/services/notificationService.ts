import apiClient from './apiClient';
import type { Notification, UnreadCount } from '@/types/notification';

export const notificationService = {
  async list(): Promise<Notification[]> {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  async getUnreadCount(): Promise<number> {
    const res = await apiClient.get('/notifications/unread-count');
    return res.data.count;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.put(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.put('/notifications/read-all');
  },
};
