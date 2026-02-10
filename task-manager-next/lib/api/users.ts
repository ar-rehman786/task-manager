import api from './client';
import { User, ApiResponse } from '../types';

export const usersApi = {
    getUsers: async () => {
        const response = await api.get<User[]>('/api/users');
        return response.data;
    },

    getMe: async () => {
        const response = await api.get<User>('/api/auth/me');
        return response.data;
    },

    createUser: async (data: Partial<User> & { password: string }) => {
        const response = await api.post<User>('/api/users', data);
        return response.data;
    },

    updateUser: async (id: number, data: Partial<User>) => {
        const response = await api.put<User>(`/api/users/${id}`, data);
        return response.data;
    },

    deleteUser: async (id: number) => {
        const response = await api.delete<ApiResponse<any>>(`/api/users/${id}`);
        return response.data;
    },
};
