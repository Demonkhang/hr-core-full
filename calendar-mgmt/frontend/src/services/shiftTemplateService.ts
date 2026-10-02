import apiClient from './apiClient';
import type { ShiftTemplate } from '@/types/schedule';
import { API_ENDPOINTS } from '@/utils/constants';

export const shiftTemplateService = {
  async list(): Promise<ShiftTemplate[]> {
    const res = await apiClient.get(API_ENDPOINTS.SHIFT_TEMPLATES);
    return res.data;
  },

  async create(data: Partial<ShiftTemplate>): Promise<ShiftTemplate> {
    const res = await apiClient.post(API_ENDPOINTS.SHIFT_TEMPLATES, data);
    return res.data;
  },

  async update(id: string, data: Partial<ShiftTemplate>): Promise<ShiftTemplate> {
    const res = await apiClient.put(API_ENDPOINTS.SHIFT_TEMPLATE(id), data);
    return res.data;
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SHIFT_TEMPLATE(id));
  },
};
