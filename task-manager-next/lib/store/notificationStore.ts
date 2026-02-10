import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Notification } from '../types';
import api from '../api/client';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notification: Notification) => void;
    setNotifications: (notifications: Notification[]) => void;
    markAsRead: (id: number) => void;
    markAllAsRead: () => void;
    clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set) => ({
            notifications: [],
            unreadCount: 0,
            addNotification: (notification) =>
                set((state) => ({
                    notifications: [notification, ...state.notifications],
                    unreadCount: state.unreadCount + 1,
                })),
            setNotifications: (notifications) =>
                set({
                    notifications,
                    unreadCount: notifications.filter((n) => !n.read).length,
                }),
            markAsRead: async (id) => {
                try {
                    // Note: We don't have a specific individual read API yet, 
                    // but we can add one if needed. For now we just update local state
                    // and eventually the "mark all as read" API handles everything.
                    set((state) => ({
                        notifications: state.notifications.map((n) =>
                            n.id === id ? { ...n, read: true } : n
                        ),
                        unreadCount: Math.max(0, state.unreadCount - 1),
                    }));
                } catch (error) {
                    console.error('Error marking as read:', error);
                }
            },
            markAllAsRead: async () => {
                try {
                    await api.put('/api/notifications/read');
                    set((state) => ({
                        notifications: state.notifications.map((n) => ({ ...n, read: true })),
                        unreadCount: 0,
                    }));
                } catch (error) {
                    console.error('Error marking all as read:', error);
                }
            },
            clearNotifications: () => set({ notifications: [], unreadCount: 0 }),
        }),
        {
            name: 'notification-storage',
        }
    )
);
