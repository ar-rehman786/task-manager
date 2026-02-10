import api from './client';

export interface AttendanceStatus {
    id: number;
    userId: number;
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

    clockIn: async (notes?: string) => {
        const response = await api.post<AttendanceStatus>('/api/attendance/clock-in', { notes });
        return response.data;
    },

    clockOut: async (notes?: string) => {
        const response = await api.post<AttendanceStatus>('/api/attendance/clock-out', { notes });
        return response.data;
    },

    getHistory: async (limit = 30) => {
        const response = await api.get<AttendanceStatus[]>(`/api/attendance/history?limit=${limit}`);
        return response.data;
    }
};
