'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useNotificationStore } from '@/lib/store/notificationStore';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { Notification } from '@/lib/types';
import api from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

export function useNotifications() {
    const user = useAuthStore((state) => state.user);
    const { addNotification, setNotifications } = useNotificationStore();
    const queryClient = useQueryClient();

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await api.get('/api/notifications');
            const mapped = response.data.map((n: any) => ({
                ...n,
                read: !!n.isRead || n.read, // Map backend isRead to frontend read
            }));
            setNotifications(mapped);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [setNotifications]);

    const playNotificationSound = useCallback(() => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch((err) => console.log('Error playing notification sound:', err));
    }, []);

    useEffect(() => {
        if (!user) return;

        const socket = getSocket();

        if (!socket.connected) {
            socket.connect();
        }

        socket.emit('join', user.id);

        const handleNotification = (notification: any) => {
            console.log('New notification received:', notification);

            // Format notification for store
            const newNotif: Notification = {
                id: Date.now(), // Fallback ID if not provided
                userId: user.id,
                message: notification.message,
                type: notification.type || 'info',
                read: false,
                createdAt: new Date().toISOString(),
                data: notification.data ? (typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data) : undefined,
            };

            addNotification(newNotif);
            playNotificationSound();

            // Slack-like popup
            toast(notification.message, {
                description: 'New Notification',
                action: {
                    label: 'View',
                    onClick: () => {
                        // Handle redirection logic if needed
                        console.log('Toast clicked', notification.data);
                    },
                },
            });
        };

        const handleDataUpdate = (data: any) => {
            console.log('Data update received:', data);
            if (data.type) {
                // Invalidate the specific query type (tasks, projects, etc.)
                queryClient.invalidateQueries({ queryKey: [data.type] });

                // Also invalidate related queries for consistency
                if (data.type === 'projects') {
                    queryClient.invalidateQueries({ queryKey: ['milestones'] });
                }
            }
        };

        socket.on('notification', handleNotification);
        socket.on('dataUpdate', handleDataUpdate);

        // Fetch initial notifications
        fetchNotifications();

        return () => {
            socket.off('notification', handleNotification);
            socket.off('dataUpdate', handleDataUpdate);
        };
    }, [user, addNotification, playNotificationSound, fetchNotifications, queryClient]);
}
