import apiClient from './apiClient';
import type { Position, PositionCreate } from '@/types/position';
import { API_ENDPOINTS, QUERY_PARAMS } from '@/utils/constants';

export const positionService = {
  /** GET /positions – danh sách chức vụ (mặc định chỉ lấy active) */
  async list(activeOnly = true): Promise<Position[]> {
    const res = await apiClient.get(API_ENDPOINTS.POSITIONS, { params: { [QUERY_PARAMS.ACTIVE_ONLY]: activeOnly } });
    return res.data;
  },

  /** GET /positions/:id – chi tiết 1 chức vụ */
  async get(id: string): Promise<Position> {
    const res = await apiClient.get(API_ENDPOINTS.POSITION(id));
    return res.data;
  },

  /** POST /positions – tạo chức vụ mới */
  async create(data: PositionCreate): Promise<Position> {
    const res = await apiClient.post(API_ENDPOINTS.POSITIONS, data);
    return res.data;
  },

  /** PUT /positions/:id – cập nhật thông tin chức vụ */
  async update(id: string, data: Partial<PositionCreate>): Promise<Position> {
    const res = await apiClient.put(API_ENDPOINTS.POSITION(id), data);
    return res.data;
  },

  /** DELETE /positions/:id – vô hiệu hoá chức vụ */
  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.POSITION(id));
  },
};
