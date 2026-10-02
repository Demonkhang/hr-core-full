import apiClient from './apiClient';
import type { JobPosition, JobPositionCreate } from '@/types/jobPosition';
import { API_ENDPOINTS, QUERY_PARAMS } from '@/utils/constants';

export const jobPositionService = {
  /** GET /job-positions – danh sách vị trí việc làm */
  async list(activeOnly = true): Promise<JobPosition[]> {
    const res = await apiClient.get(API_ENDPOINTS.JOB_POSITIONS, {
      params: { [QUERY_PARAMS.ACTIVE_ONLY]: activeOnly },
    });
    return res.data;
  },

  /** GET /job-positions/:id – chi tiết 1 vị trí việc làm */
  async get(id: string): Promise<JobPosition> {
    const res = await apiClient.get(API_ENDPOINTS.JOB_POSITION(id));
    return res.data;
  },

  /** POST /job-positions – tạo vị trí việc làm mới */
  async create(data: JobPositionCreate): Promise<JobPosition> {
    const res = await apiClient.post(API_ENDPOINTS.JOB_POSITIONS, data);
    return res.data;
  },

  /** PUT /job-positions/:id – cập nhật vị trí việc làm */
  async update(id: string, data: Partial<JobPositionCreate>): Promise<JobPosition> {
    const res = await apiClient.put(API_ENDPOINTS.JOB_POSITION(id), data);
    return res.data;
  },

  /** DELETE /job-positions/:id – vô hiệu hoá vị trí việc làm */
  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.JOB_POSITION(id));
  },
};
