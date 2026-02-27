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
        <header className="h-11 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 flex-none">
            {/* Search */}
            <div className="flex-1 max-w-xs">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                    <Input
                        placeholder="Search tasks, projects…"
                        className="pl-8 h-7 text-xs rounded-md"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
                {/* Theme Toggle */}
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-accent transition-colors text-[11px] font-medium text-foreground"
                    title="Toggle theme"
                >
                    {theme === 'dark'
                        ? <><Sun size={12} className="text-amber-400" /><span className="hidden sm:inline">Light</span></>
                        : <><Moon size={12} className="text-primary" /><span className="hidden sm:inline">Dark</span></>}
                </button>

                {/* Notifications */}
                <NotificationDropdown />

                {/* User info */}
                <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-[11px] font-semibold leading-none">{user?.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{user?.role}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Logout */}
                <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7">
                    <LogOut size={14} />
                </Button>
            </div>
        </header>
    );
}
