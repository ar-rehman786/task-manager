'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { useNotificationStore } from '@/lib/store/notificationStore';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { Notification } from '@/lib/types';
import api from '@/lib/api/client';

export function useNotifications() {
    const user = useAuthStore((state) => state.user);
    const { addNotification, setNotifications } = useNotificationStore();

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

        socket.on('notification', handleNotification);

        // Fetch initial notifications
        fetchNotifications();

        return () => {
            socket.off('notification', handleNotification);
        };
    }, [user, addNotification, playNotificationSound, fetchNotifications]);
}
