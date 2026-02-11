'use client';

import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/lib/store/notificationStore';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function NotificationDropdown() {
    const router = useRouter();
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

    const handleNotificationClick = (notification: any) => {
        markAsRead(notification.id);

        const data = notification.data || {};
        if (data.taskId) {
            router.push(`/tasks`);
        } else if (data.projectId) {
            router.push(`/projects?id=${data.projectId}`);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" size={16} />;
            case 'warning': return <AlertTriangle className="text-yellow-500" size={16} />;
            case 'error': return <XCircle className="text-red-500" size={16} />;
            default: return <Info className="text-blue-500" size={16} />;
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-4 bg-muted/50">
                    <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                markAllAsRead();
                            }}
                        >
                            Mark all as read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="mx-auto mb-2 opacity-20" size={32} />
                            <p className="text-sm">No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <DropdownMenuItem
                                key={n.id}
                                className={cn(
                                    "flex items-start gap-3 p-4 border-b last:border-0 cursor-pointer focus:bg-muted/50",
                                    !n.read && "bg-primary/5"
                                )}
                                onClick={() => handleNotificationClick(n)}
                            >
                                <div className="mt-1">{getIcon(n.type)}</div>
                                <div className="flex-1 space-y-1">
                                    <p className={cn("text-sm transition-colors", !n.read && "font-medium")}>
                                        {n.message}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                    </p>
                                </div>
                                {!n.read && (
                                    <div className="mt-1 w-2 h-2 rounded-full bg-primary" />
                                )}
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator className="m-0" />
                        <Button
                            variant="ghost"
                            className="w-full h-10 text-xs rounded-t-none"
                            onClick={() => router.push('/notifications')} // If we add a full page later
                        >
                            View all notifications
                        </Button>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
