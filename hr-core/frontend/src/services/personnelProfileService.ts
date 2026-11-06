import apiClient from './apiClient';
import type {
  VcProfileDetail,
  VcProfileListItem,
  SubRecordType,
  WordParsePreview,
  WordImportApplyPayload,
} from '@/types/personnelProfile';

const BASE_URL = '/personnel-profiles';

export const personnelProfileService = {
  async list(): Promise<VcProfileListItem[]> {
    const res = await apiClient.get(BASE_URL);
    return res.data;
  },

  async getByUser(userId: string): Promise<VcProfileDetail> {
    const res = await apiClient.get(`${BASE_URL}/by-user/${userId}`);
    return res.data;
  },

  async updateByUser(userId: string, data: Partial<VcProfileDetail>): Promise<VcProfileDetail> {
    const res = await apiClient.put(`${BASE_URL}/by-user/${userId}`, data);
    return res.data;
  },

  async uploadPortrait(userId: string, file: File): Promise<{ portrait_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`${BASE_URL}/by-user/${userId}/portrait`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async uploadAssetFile(userId: string, file: File): Promise<{ file_url: string; file_name: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`${BASE_URL}/by-user/${userId}/asset-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async parseWordFile(userId: string, file: File): Promise<WordParsePreview> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`${BASE_URL}/by-user/${userId}/parse-word`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async applyWordImport(userId: string, payload: WordImportApplyPayload): Promise<VcProfileDetail> {
    const res = await apiClient.post(`${BASE_URL}/by-user/${userId}/apply-word-import`, payload);
    return res.data;
  },

  async createSubRecord(userId: string, subType: SubRecordType, payload: Record<string, any>): Promise<VcProfileDetail> {
    const res = await apiClient.post(`${BASE_URL}/by-user/${userId}/sub/${subType}`, payload);
    return res.data;
  },

  async updateSubRecord(
    userId: string,
    subType: SubRecordType,
    recordId: string,
    payload: Record<string, any>
  ): Promise<VcProfileDetail> {
    const res = await apiClient.put(`${BASE_URL}/by-user/${userId}/sub/${subType}/${recordId}`, payload);
    return res.data;
  },

  async deleteSubRecord(userId: string, subType: SubRecordType, recordId: string): Promise<VcProfileDetail> {
    const res = await apiClient.delete(`${BASE_URL}/by-user/${userId}/sub/${subType}/${recordId}`);
    return res.data;
  },
};

