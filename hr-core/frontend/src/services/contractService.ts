import apiClient from './apiClient';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  Contract,
  ContractCreate,
  ContractUpdate,
  ContractRenewRequest,
  ContractTerminateRequest,
  ContractAppendix,
  ContractAppendixCreate,
  ContractDashboardSummary,
} from '@/types/contract';

export const contractService = {
  /** Lấy danh sách hợp đồng có bộ lọc */
  async list(params?: {
    employee_id?: string;
    department_id?: string;
    contract_type?: string;
    status?: string;
    expiry_window?: '15_days' | '30_days' | '60_days' | 'overdue' | string;
    search?: string;
  }): Promise<Contract[]> {
    const res = await apiClient.get(API_ENDPOINTS.CONTRACTS, { params });
    return res.data;
  },

  /** Lấy chi tiết 1 hợp đồng */
  async get(id: string): Promise<Contract> {
    const res = await apiClient.get(API_ENDPOINTS.CONTRACT(id));
    return res.data;
  },

  /** Tạo hợp đồng mới */
  async create(data: ContractCreate, force = false): Promise<Contract> {
    const res = await apiClient.post(API_ENDPOINTS.CONTRACTS, data, {
      params: force ? { force: true } : undefined,
    });
    return res.data;
  },

  /** Cập nhật thông tin hợp đồng */
  async update(id: string, data: ContractUpdate): Promise<Contract> {
    const res = await apiClient.put(API_ENDPOINTS.CONTRACT(id), data);
    return res.data;
  },

  /** Xóa hợp đồng */
  async delete(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.CONTRACT(id));
  },

  /** Ký tiếp / Gia hạn hợp đồng */
  async renew(id: string, data: ContractRenewRequest): Promise<Contract> {
    const res = await apiClient.post(API_ENDPOINTS.CONTRACT_RENEW(id), data);
    return res.data;
  },

  /** Chấm dứt / Thanh lý hợp đồng */
  async terminate(id: string, data: ContractTerminateRequest): Promise<Contract> {
    const res = await apiClient.post(API_ENDPOINTS.CONTRACT_TERMINATE(id), data);
    return res.data;
  },

  /** Thống kê dashboard về hạn hợp đồng */
  async getDashboardSummary(): Promise<ContractDashboardSummary> {
    const res = await apiClient.get(API_ENDPOINTS.CONTRACT_DASHBOARD_SUMMARY);
    return res.data;
  },

  /** Danh sách phụ lục của hợp đồng */
  async listAppendices(contractId: string): Promise<ContractAppendix[]> {
    const res = await apiClient.get(API_ENDPOINTS.CONTRACT_APPENDICES(contractId));
    return res.data;
  },

  /** Tạo phụ lục hợp đồng */
  async createAppendix(contractId: string, data: ContractAppendixCreate): Promise<ContractAppendix> {
    const res = await apiClient.post(API_ENDPOINTS.CONTRACT_APPENDICES(contractId), data);
    return res.data;
  },

  /** Xóa phụ lục hợp đồng */
  async deleteAppendix(contractId: string, appendixId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.CONTRACT_APPENDIX(contractId, appendixId));
  },

  /** Upload file scan hợp đồng */
  async uploadAttachment(file: File): Promise<{ file_url: string; filename: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(API_ENDPOINTS.CONTRACT_UPLOAD_ATTACHMENT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
