import apiClient from './apiClient';
import type {
  PersonnelAlertDashboardResponse,
  PersonalProfileMapResponse,
  AlertWorkflowStatusType,
  CompleteAlertDecisionPayload,
  ExtendAlertPayload,
  RejectAlertPayload,
  RollbackAlertPayload,
} from '@/types/personnelAlert';

const BASE_URL = '/personnel-alerts';

export const personnelAlertService = {
  async getDashboard(): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.get(BASE_URL);
    return res.data;
  },

  async getPersonalProfileMap(): Promise<PersonalProfileMapResponse> {
    const res = await apiClient.get(`${BASE_URL}/personal-profiles`);
    return res.data;
  },

  async manualScan(): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.post(`${BASE_URL}/scan`);
    return res.data;
  },

  async batchUpdateStatus(
    alertIds: string[],
    workflowStatus: AlertWorkflowStatusType,
    processNotes?: string
  ): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.patch(`${BASE_URL}/batch-status`, {
      alert_ids: alertIds,
      workflow_status: workflowStatus,
      process_notes: processNotes,
    });
    return res.data;
  },

  async uploadDecisionFile(file: File): Promise<{ file_url: string; file_name: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`${BASE_URL}/upload-decision`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async completeAlertDecision(
    alertId: string,
    payload: CompleteAlertDecisionPayload
  ): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.post(`${BASE_URL}/${alertId}/complete`, payload);
    return res.data;
  },

  async extendAlert(
    alertId: string,
    payload: ExtendAlertPayload
  ): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.post(`${BASE_URL}/${alertId}/extend`, payload);
    return res.data;
  },

  async rejectAlert(
    alertId: string,
    payload: RejectAlertPayload
  ): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.post(`${BASE_URL}/${alertId}/reject`, payload);
    return res.data;
  },

  async rollbackOrHoldAlert(
    alertId: string,
    payload: RollbackAlertPayload
  ): Promise<PersonnelAlertDashboardResponse> {
    const res = await apiClient.post(`${BASE_URL}/${alertId}/rollback`, payload);
    return res.data;
  },
};
