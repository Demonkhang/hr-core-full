import apiClient from './apiClient';
import type { Department, DepartmentCreate } from '@/types/department';
import { API_ENDPOINTS, QUERY_PARAMS } from '@/utils/constants';

export const departmentService = {
  /** GET /departments – danh sách phòng ban (mặc định chỉ lấy active) */
  async list(activeOnly = true): Promise<Department[]> {
    const res = await apiClient.get(API_ENDPOINTS.DEPARTMENTS, { params: { [QUERY_PARAMS.ACTIVE_ONLY]: activeOnly } });
    return res.data;
  },

  /** GET /departments/:id – chi tiết 1 phòng ban */
  async get(id: string): Promise<Department> {
    const res = await apiClient.get(API_ENDPOINTS.DEPARTMENT(id));
    return res.data;
  },

  /** POST /departments – tạo phòng ban mới */
  async create(data: DepartmentCreate): Promise<Department> {
    const res = await apiClient.post(API_ENDPOINTS.DEPARTMENTS, data);
    return res.data;
  },

  /** PUT /departments/:id – cập nhật thông tin phòng ban */
  async update(id: string, data: Partial<DepartmentCreate>): Promise<Department> {
    const res = await apiClient.put(API_ENDPOINTS.DEPARTMENT(id), data);
    return res.data;
  },

  /** DELETE /departments/:id – vô hiệu hoá phòng ban */
  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.DEPARTMENT(id));
  },
};
