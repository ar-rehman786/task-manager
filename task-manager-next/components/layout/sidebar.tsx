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
    MessageSquare,
    Code2,
    Phone,
    CalendarPlus,
    Megaphone,
} from 'lucide-react';
import { useStickyStore } from '@/lib/store/stickyStore';

interface NavItem {
    name: string;
    href: string;
    icon: any;
    adminOnly?: boolean;
}

interface NavSection {
    label?: string;
    items: NavItem[];
}

const sections: NavSection[] = [
    {
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Tasks', href: '/tasks', icon: CheckSquare },
            { name: 'Projects', href: '/projects', icon: FolderKanban },
            { name: 'Ideation', href: '/ideation', icon: Lightbulb },
        ],
    },
    {
        label: 'Outreach',
        items: [
            { name: 'Daily Reports', href: '/daily-reports', icon: Phone },
            { name: 'Appointments', href: '/appointments', icon: CalendarPlus },
        ],
    },
    {
        items: [
            { name: 'Chat', href: '/chat', icon: MessageSquare },
            { name: 'Organization', href: '/organization', icon: Building2 },
            { name: 'Team', href: '/team', icon: Users },
            { name: 'Attendance', href: '/attendance', icon: Clock },
            { name: 'Profile', href: '/profile', icon: UserCircle },
            { name: 'Apis', href: '/api-docs', icon: Code2, adminOnly: true },
        ],
    },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);

    return (
        <aside
            className={cn(
                'bg-card border-r border-border transition-all duration-300 flex flex-col',
                collapsed ? 'w-[60px]' : 'w-[228px]'
            )}
        >
            {/* Header */}
            <div className="px-3 py-3 border-b border-border flex items-center justify-between min-h-[48px]">
                {!collapsed && (
                    <h1 className="text-[14px] font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent truncate leading-tight">
                        SloraAI Workspace
                    </h1>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0 ml-auto"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2.5 py-2.5 space-y-0.5 overflow-y-auto">
                {sections.map((section, sIdx) => (
                    <div key={sIdx}>
                        {section.label && (
                            <div className={cn(
                                'pt-3 pb-1.5',
                                sIdx > 0 && 'mt-1.5 border-t border-border'
                            )}>
                                {!collapsed && (
                                    <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                                        {section.label}
                                    </span>
                                )}
                                {collapsed && (
                                    <div className="flex justify-center">
                                        <Megaphone size={12} className="text-muted-foreground/40" />
                                    </div>
                                )}
                            </div>
                        )}
                        {!section.label && sIdx > 0 && (
                            <div className="pt-1.5 mt-1.5 border-t border-border" />
                        )}
                        {section.items.map((item) => {
                            if (item.adminOnly && user?.role !== 'admin') return null;

                            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                            const Icon = item.icon;

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-[13px]',
                                        isActive
                                            ? 'bg-primary text-primary-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                    )}
                                >
                                    <Icon size={17} className="flex-shrink-0" />
                                    {!collapsed && <span className="font-medium truncate">{item.name}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}

                <div className="pt-2 mt-2 border-t border-border">
                    <button
                        onClick={() => useStickyStore.getState().addSticky()}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-md transition-colors w-full text-left text-[13px]',
                            'hover:bg-yellow-50 hover:text-yellow-700 text-muted-foreground'
                        )}
                    >
                        <StickyNote size={17} className="text-yellow-500 flex-shrink-0" />
                        {!collapsed && <span className="font-medium">New Sticky</span>}
                    </button>
                </div>
            </nav>
        </aside>
    );
}
