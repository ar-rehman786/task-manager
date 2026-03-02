import api from './client';

export interface AttendanceStatus {
    id: number;
    userId: number;
    userName?: string;
    clientId?: number;
    clientName?: string;
    clockInTime: string;
    clockOutTime?: string;
    status: 'active' | 'completed';
    workDuration?: number;
    notes?: string;
}

export const attendanceApi = {
    getStatus: async () => {
        const response = await api.get<AttendanceStatus | null>('/api/attendance/status');
        return response.data;
    },

    clockIn: async (data?: { clientId?: number, notes?: string }) => {
        const response = await api.post<AttendanceStatus>('/api/attendance/clock-in', data || {});
        return response.data;
    },

    clockOut: async (notes?: string) => {
        const response = await api.post<AttendanceStatus>('/api/attendance/clock-out', { notes });
        return response.data;
    },

    getHistory: async (all = false) => {
        const response = await api.get<AttendanceStatus[]>(`/api/attendance/history?all=${all}`);
        return response.data;
    },

    getAdminTotals: async () => {
        const response = await api.get<{
            today: number,
            week: number,
            month: number
        }>('/api/attendance/totals');
        return response.data;
    },

    getEmployeeTotals: async () => {
        const response = await api.get<any[]>('/api/attendance/employee-totals');
        return response.data;
    },

    getClientTotals: async () => {
        const response = await api.get<any[]>('/api/attendance/client-totals');
        return response.data;
    },

    updateRecord: async (id: number, data: { clockInTime?: string; clockOutTime?: string; notes?: string }) => {
        const response = await api.put<AttendanceStatus>(`/api/attendance/${id}`, data);
        return response.data;
    }
};
