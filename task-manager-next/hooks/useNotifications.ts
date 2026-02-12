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
        // Valid short "ding" sound
        const sound = "data:audio/mp3;base64,SUQzBAAAAAABAFRYWFhYAAAASAAAbWFya2VyX25vdGlmaWNhdGlvbi5tcDMAbWFya2VyX25vdGlmaWNhdGlvbi5tcDMAXy9uYXR1cmFsX25vdGlmaWNhdGlvbl9hcnBlZ2dpby5tcDMAX//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYaW5nAAAADAAAAAUAACH4AAMHCgsPEBMVGBocHx8iJSYpLC8yNTY5Oz9BQ0VIS09SVRZcXF5hZGZpanBycnZ3eXt/gYOGiImLkZOVmZueoaOmqKmrrbGztbe5u7/BwsXGyc3R09XY293f4OLm5+nr7fHz9fj7/wAAAAxMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uQZAAAC8V9PjmgAAIk9y7fMAAAUu3v+WvXAAAk7Xidp2uAAP/86i817z6Lz/vO97zXvea94A//S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvOfS80173vPeea97//6WmvOfS80173vPeea97///8A/+l///S8///oWmvgAA=";
        const audio = new Audio(sound);
        audio.play().catch((err) => console.log('🔔 Error playing notification sound:', err));
    }, []);

    useEffect(() => {
        if (!user) return;

        const socket = getSocket();

        if (!socket.connected) {
            socket.connect();
        }

        socket.emit('join', user.id);

        const handleNotification = (notification: any) => {
            console.log('🔔 Notification received via socket:', notification);

            // Format notification for store
            const newNotif: Notification = {
                id: notification.id || Date.now() + Math.random(),
                userId: user.id,
                message: notification.message,
                type: notification.type || 'info',
                read: false,
                createdAt: new Date().toISOString(),
                data: notification.data ? (typeof notification.data === 'string' ? JSON.parse(notification.data) : notification.data) : undefined,
            };

            addNotification(newNotif);
            playNotificationSound();

            console.log('🚀 Showing toast for:', notification.message);
            // Slack-like popup
            toast(notification.message, {
                description: 'New Workspace Notification',
                action: {
                    label: 'View',
                    onClick: () => {
                        console.log('Toast action clicked', notification.data);
                    },
                },
            });
        };

        const handleDataUpdate = (data: any) => {
            console.log('🔄 Data update signal received:', data);
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

        socket.on('connect', () => {
            console.log('✅ Socket connected, joining room:', user.id);
            socket.emit('join', user.id);
        });

        if (socket.connected) {
            console.log('✅ Socket already connected, joining room:', user.id);
            socket.emit('join', user.id);
        }

        // Fetch initial notifications
        fetchNotifications();

        return () => {
            console.log('🔌 Cleaning up socket listeners');
            socket.off('notification', handleNotification);
            socket.off('dataUpdate', handleDataUpdate);
            socket.off('connect');
        };
    }, [user, addNotification, playNotificationSound, fetchNotifications, queryClient]);
}
