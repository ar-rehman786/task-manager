import api from './client';
import { Task, ApiResponse } from '../types';

export const tasksApi = {
    // Get all tasks
    getTasks: async () => {
        const response = await api.get<Task[]>('/api/tasks');
        return response.data;
    },

    // Get single task
    getTask: async (id: number) => {
        const response = await api.get<Task>(`/api/tasks/${id}`);
        return response.data;
    },

    // Create task
    createTask: async (data: Partial<Task>) => {
        const response = await api.post<Task>('/api/tasks', data);
        return response.data;
    },

    // Update task
    updateTask: async (id: number, data: Partial<Task>) => {
        const response = await api.put<Task>(`/api/tasks/${id}`, data);
        return response.data;
    },

    // Delete task
    deleteTask: async (id: number) => {
        const response = await api.delete<ApiResponse<any>>(`/api/tasks/${id}`);
        return response.data;
    },
};
