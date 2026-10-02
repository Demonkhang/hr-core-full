import apiClient from './apiClient';

export interface CalendarPermission {
  id: string;
  name: string;
  code: string;
  scope: string;
  employee_count: number;
  can_read_schedule: boolean;
  can_create_schedule: boolean;
  can_update_schedule: boolean;
  can_delete_schedule: boolean;
  can_approve_schedule: boolean;
  can_manage_leave: boolean;
  can_approve_leave: boolean;
  can_manage_overtime: boolean;
  can_approve_overtime: boolean;
  can_manage_meetings: boolean;
  can_approve_meetings: boolean;
  is_active: boolean;
}

export const permissionService = {
  listCalendarPermissions: async (): Promise<CalendarPermission[]> => {
    const response = await apiClient.get<CalendarPermission[]>('/permissions/positions');
    return response.data;
  },

  updateCalendarPermission: async (id: string, data: Partial<CalendarPermission>): Promise<CalendarPermission> => {
    const response = await apiClient.put<CalendarPermission>(`/permissions/positions/${id}`, data);
    return response.data;
  },
};
