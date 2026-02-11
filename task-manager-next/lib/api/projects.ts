import { Project, Milestone, AccessItem, ProjectLog, Transcription, Task } from '../types';
import api from './client';

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
        const response = await api.delete(`/api/projects/${id}`);
        return response.data;
    },

    // Milestones
    getGlobalMilestones: async () => {
        const response = await api.get<Milestone[]>('/api/milestones');
        return response.data;
    },

    getMilestones: async (projectId: number) => {
        const response = await api.get<Milestone[]>(`/api/projects/${projectId}/milestones`);
        return response.data;
    },

    getProjectTasks: async (projectId: number) => {
        const response = await api.get<Task[]>(`/api/projects/${projectId}/tasks`);
        return response.data;
    },

    createMilestone: async (projectId: number, data: Partial<Milestone>) => {
        const response = await api.post<Milestone>(`/api/projects/${projectId}/milestones`, data);
        return response.data;
    },

    updateMilestone: async (id: number, data: Partial<Milestone>) => {
        const response = await api.put<Milestone>(`/api/milestones/${id}`, data);
        return response.data;
    },

    deleteMilestone: async (id: number) => {
        const response = await api.delete(`/api/milestones/${id}`);
        return response.data;
    },

    // Access Items
    getAccessItems: async (projectId: number) => {
        const response = await api.get<AccessItem[]>(`/api/projects/${projectId}/access`);
        return response.data;
    },

    createAccessItem: async (projectId: number, data: Partial<AccessItem>) => {
        const response = await api.post<AccessItem>(`/api/projects/${projectId}/access`, data);
        return response.data;
    },

    updateAccessItem: async (id: number, data: Partial<AccessItem>) => {
        const response = await api.put<AccessItem>(`/api/access/${id}`, data);
        return response.data;
    },

    // Logs
    getProjectLogs: async (projectId: number) => {
        const response = await api.get<ProjectLog[]>(`/api/projects/${projectId}/logs`);
        return response.data;
    },

    // Transcriptions
    getTranscriptions: async (projectId: number) => {
        const response = await api.get<Transcription[]>(`/api/projects/${projectId}/transcriptions`);
        return response.data;
    },

    createTranscription: async (projectId: number, data: Partial<Transcription>) => {
        const response = await api.post<Transcription>(`/api/projects/${projectId}/transcriptions`, data);
        return response.data;
    },
};
