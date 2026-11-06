import apiClient from './apiClient';
import {
    MobileSpecialistSummaryResponse,
    MobileScheduleCreate,
    MobileScheduleItem,
    MobileLeaveRequestCreate,
    MobileLeaveRequestItem,
    MobileOvertimeCreate,
    MobileOvertimeItem,
} from '../types/mobileEss';

export const mobileEssService = {
    getMySummary: async (): Promise<MobileSpecialistSummaryResponse> => {
        const res = await apiClient.get<MobileSpecialistSummaryResponse>('/mobile-ess/me');
        return res.data;
    },

    createSchedule: async (payload: MobileScheduleCreate): Promise<MobileScheduleItem> => {
        const res = await apiClient.post<MobileScheduleItem>('/mobile-ess/schedules', payload);
        return res.data;
    },

    deleteSchedule: async (scheduleId: string): Promise<void> => {
        await apiClient.delete(`/mobile-ess/schedules/${scheduleId}`);
    },

    createLeaveRequest: async (payload: MobileLeaveRequestCreate): Promise<MobileLeaveRequestItem> => {
        const res = await apiClient.post<MobileLeaveRequestItem>('/mobile-ess/leave-requests', payload);
        return res.data;
    },

    cancelLeaveRequest: async (requestId: string): Promise<void> => {
        await apiClient.delete(`/mobile-ess/leave-requests/${requestId}`);
    },

    createOvertimeRequest: async (payload: MobileOvertimeCreate): Promise<MobileOvertimeItem> => {
        const res = await apiClient.post<MobileOvertimeItem>('/mobile-ess/overtime-requests', payload);
        return res.data;
    },

    cancelOvertimeRequest: async (requestId: string): Promise<void> => {
        await apiClient.delete(`/mobile-ess/overtime-requests/${requestId}`);
    },
};
