import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for handling errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Only redirect if we're in the browser
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                // Use a standard logout instead of raw redirect if possible,
                // but let's stick to simple fix for now.
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
