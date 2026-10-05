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

  /** GET /job-positions/export – xuất Excel */
  async export(activeOnly = false): Promise<Blob> {
    const res = await apiClient.get(API_ENDPOINTS.JOB_POSITIONS_EXPORT, {
      params: { active_only: activeOnly },
      responseType: 'blob',
    });
    return res.data;
  },

  /** GET /job-positions/import/template – tải file mẫu */
  async downloadTemplate(): Promise<Blob> {
    const res = await apiClient.get(API_ENDPOINTS.JOB_POSITIONS_IMPORT_TEMPLATE, {
      responseType: 'blob',
    });
    return res.data;
  },

  /** POST /job-positions/import – nhập file Excel */
  async import(file: File): Promise<{ imported_count: number; created_count: number; updated_count: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(API_ENDPOINTS.JOB_POSITIONS_IMPORT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
