import api from './client';
import { IdeationBoard } from '../types';

export const ideationApi = {
    getBoards: async () => {
        const response = await api.get<IdeationBoard[]>('/api/ideation');
        return response.data;
    },

    getBoard: async (id: number) => {
        const response = await api.get<IdeationBoard>(`/api/ideation/${id}`);
        return response.data;
    },

    createBoard: async (data: Partial<IdeationBoard>) => {
        const response = await api.post<IdeationBoard>('/api/ideation', data);
        return response.data;
    },

    updateBoard: async (id: number, data: Partial<IdeationBoard>) => {
        const response = await api.put<IdeationBoard>(`/api/ideation/${id}`, data);
        return response.data;
    },

    deleteBoard: async (id: number) => {
        const response = await api.delete(`/api/ideation/${id}`);
        return response.data;
    },
};
