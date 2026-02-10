'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sun, Moon, Search, LogOut } from 'lucide-react';
import { NotificationDropdown } from './notification-dropdown';
import { useNotifications } from '@/hooks/useNotifications';

export default function Topbar() {
    useNotifications();
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const { theme, setTheme } = useTheme();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
            {/* Search */}
            <div className="flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        placeholder="Search tasks, projects..."
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </Button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User Menu */}
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-semibold">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Logout */}
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut size={20} />
                </Button>
            </div>
        </header>
    );
}
