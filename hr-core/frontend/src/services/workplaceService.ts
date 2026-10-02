import apiClient from './apiClient';
import type { Workplace, WorkplaceCreate } from '@/types/workplace';
import { API_ENDPOINTS } from '@/utils/constants';

export const workplaceService = {
  /** GET /workplaces – danh sách nơi làm việc */
  async list(params?: { active_only?: boolean }): Promise<Workplace[]> {
    const res = await apiClient.get(API_ENDPOINTS.WORKPLACES, { params });
    return res.data;
  },

  /** GET /workplaces/:id – chi tiết 1 nơi làm việc */
  async get(id: string): Promise<Workplace> {
    const res = await apiClient.get(API_ENDPOINTS.WORKPLACE(id));
    return res.data;
  },

  /** POST /workplaces – tạo nơi làm việc mới */
  async create(data: WorkplaceCreate): Promise<Workplace> {
    const res = await apiClient.post(API_ENDPOINTS.WORKPLACES, data);
    return res.data;
  },

  /** PUT /workplaces/:id – cập nhật nơi làm việc */
  async update(id: string, data: Partial<WorkplaceCreate>): Promise<Workplace> {
    const res = await apiClient.put(API_ENDPOINTS.WORKPLACE(id), data);
    return res.data;
  },

  /** DELETE /workplaces/:id – vô hiệu hoá nơi làm việc */
  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.WORKPLACE(id));
  },
};
