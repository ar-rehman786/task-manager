import api from './client';
import { Project, ApiResponse } from '../types';

export const projectsApi = {
    getProjects: async () => {
        const response = await api.get<Project[]>('/api/projects');
        return response.data;
    },

    getProject: async (id: number) => {
        const response = await api.get<Project>(`/api/projects/${id}`);
        return response.data;
    },

    createProject: async (data: Partial<Project>) => {
        const response = await api.post<Project>('/api/projects', data);
        return response.data;
    },

    updateProject: async (id: number, data: Partial<Project>) => {
        const response = await api.put<Project>(`/api/projects/${id}`, data);
        return response.data;
    },

    deleteProject: async (id: number) => {
        const response = await api.delete<ApiResponse<any>>(`/api/projects/${id}`);
        return response.data;
    },
};
