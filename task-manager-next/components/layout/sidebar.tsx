'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    CheckSquare,
    FolderKanban,
    Users,
    Clock,
    UserCircle,
    ChevronLeft,
    ChevronRight,
    Lightbulb,
    StickyNote,
    Building2,
} from 'lucide-react';
import { useStickyStore } from '@/lib/store/stickyStore';

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Ideation', href: '/ideation', icon: Lightbulb },
    { name: 'Organization', href: '/organization', icon: Building2 },
    { name: 'Team', href: '/team', icon: Users },
    { name: 'Attendance', href: '/attendance', icon: Clock },
    { name: 'Profile', href: '/profile', icon: UserCircle },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);

    return (
        <aside
            className={cn(
                'bg-card border-r border-border transition-all duration-300 flex flex-col',
                collapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                {!collapsed && (
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                        SloraAI Workspace
                    </h1>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 hover:bg-accent rounded-md transition-colors"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navigation.map((item) => {
                    // Only show team for admins
                    if (item.name === 'Team' && user?.role !== 'admin') return null;

                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-accent hover:text-accent-foreground'
                            )}
                        >
                            <Icon size={20} />
                            {!collapsed && <span className="font-medium">{item.name}</span>}
                        </Link>
                    );
                })}

                <div className="pt-4 mt-4 border-t border-border">
                    <button
                        onClick={() => useStickyStore.getState().addSticky()}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-left',
                            'hover:bg-yellow-50 hover:text-yellow-700 text-muted-foreground'
                        )}
                    >
                        <StickyNote size={20} className="text-yellow-500" />
                        {!collapsed && <span className="font-medium">New Sticky</span>}
                    </button>
                </div>
            </nav>
        </aside>
    );
}
