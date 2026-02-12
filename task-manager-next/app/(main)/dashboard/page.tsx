'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { tasksApi } from '@/lib/api/tasks';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import api from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { attendanceApi } from '@/lib/api/attendance';
import Link from 'next/link';

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}

function DashboardContent() {
    const user = useAuthStore((state) => state.user);
    const queryClient = useQueryClient();
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    // Fetch data
    const { data: tasks = [] } = useQuery({
        queryKey: ['tasks'],
        queryFn: tasksApi.getTasks,
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getProjects,
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.getUsers,
    });

    const { data: milestones = [] } = useQuery({
        queryKey: ['milestones', 'global'],
        queryFn: projectsApi.getGlobalMilestones,
    });

    const { data: attendanceStatus } = useQuery({
        queryKey: ['attendance-status'],
        queryFn: attendanceApi.getStatus,
    });

    const clockInMutation = useMutation({
        mutationFn: () => attendanceApi.clockIn(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
        },
    });

    const clockOutMutation = useMutation({
        mutationFn: () => attendanceApi.clockOut(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
        },
    });

    const updateProjectMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => projectsApi.updateProject(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const handleClockInOut = () => {
        if (attendanceStatus?.status === 'active') {
            clockOutMutation.mutate();
        } else {
            clockInMutation.mutate();
        }
    };

    const handleStatusChange = (projectId: number, newStatus: string) => {
        updateProjectMutation.mutate({ id: projectId, data: { status: newStatus } });
    };

    const isClockLoading = clockInMutation.isPending || clockOutMutation.isPending;

    // Calculate stats
    const isAdmin = user?.role === 'admin';

    const myTasks = useMemo(() => tasks.filter((t: any) => t.assignedUserId === user?.id), [tasks, user?.id]);

    const todoTasks = useMemo(() => myTasks.filter((t: any) => t.status === 'todo' || t.status === 'in_progress'), [myTasks]);

    const activeProjects = useMemo(() => projects.filter((p: any) => p.status === 'active'), [projects]);

    const hoursToday = attendanceStatus?.workDuration
        ? Math.floor(attendanceStatus.workDuration / 60)
        : 0;

    const teamWorkload = useMemo(() => users.map((u: any) => ({
        ...u,
        activeProjects: projects.filter((p: any) => p.assignedUserId === u.id && p.status === 'active')
    })), [users, projects]);

    const pendingAccessProjects = useMemo(() => projects.filter((p: any) => {
        const pendingCount = Number(p.pendingAccessCount || 0);
        const hasPending = pendingCount > 0;
        if (!hasPending) return false;
        if (user?.role === 'admin') return true;
        return p.assignedUserId === user?.id || p.managerId === user?.id;
    }), [projects, user?.role, user?.id]);

    // Recent activity
    const recentTasks = useMemo(() => [...tasks]
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5), [tasks]);

    const projectStatuses = [
        { value: 'active', label: 'Active', color: 'bg-green-500' },
        { value: 'paused', label: 'Paused', color: 'bg-yellow-500' },
        { value: 'closed', label: 'Closed', color: 'bg-red-500' },
        { value: 'waiting_for_client_response', label: 'Waiting for Client', color: 'bg-blue-500' },
        { value: 'on_hold', label: 'On Hold', color: 'bg-orange-500' },
        { value: 'completed', label: 'Completed', color: 'bg-gray-500' },
    ];

    return (
        <div className="p-6 space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}! 👋</h1>
                    <p className="text-lg opacity-90">{currentDate}</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm opacity-80 uppercase tracking-wider font-semibold">Current Status</p>
                        <p className="text-xl font-bold">
                            {attendanceStatus?.status === 'active' ? '🟢 Working' : '⚪ Not clocked in'}
                        </p>
                    </div>
                    <Button
                        size="lg"
                        variant="secondary"
                        className="bg-white text-primary hover:bg-white/90 font-bold px-8"
                        onClick={handleClockInOut}
                        disabled={isClockLoading}
                    >
                        {isClockLoading ? 'Loading...' : attendanceStatus?.status === 'active' ? 'Clock Out' : 'Clock In'}
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link href="/tasks" className="block">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">My Tasks</p>
                                <p className="text-3xl font-bold mt-2">{myTasks.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {todoTasks.length} to do
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <span className="text-2xl">📝</span>
                            </div>
                        </div>
                    </Card>
                </Link>

                <Link href="/projects" className="block">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Projects</p>
                                <p className="text-3xl font-bold mt-2">{activeProjects.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {projects.length} total
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                                <span className="text-2xl">📂</span>
                            </div>
                        </div>
                    </Card>
                </Link>

                <Link href="/projects" className="block">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Upcoming Milestones</p>
                                <p className="text-3xl font-bold mt-2">{milestones.filter((m: any) => m.status !== 'done').length}</p>
                                <p className="text-xs text-muted-foreground mt-1">in progress</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-2xl">🚩</span>
                            </div>
                        </div>
                    </Card>
                </Link>

                <Link href="/attendance" className="block">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Hours Today</p>
                                <p className="text-3xl font-bold mt-2">{hoursToday}h</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {attendanceStatus?.status === 'active' ? 'Total duration so far' : 'Complete for today'}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <span className="text-2xl">⏱️</span>
                            </div>
                        </div>
                    </Card>
                </Link>
            </div>

            {/* Upcoming Milestones */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <span>🚩</span> Upcoming Milestones
                    </h2>
                    <Link href="/projects" className="text-sm text-primary hover:underline">
                        View All →
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {milestones.filter((m: any) => m.status !== 'done').slice(0, 6).map((m: any) => (
                        <div key={m.id} className="border rounded-xl p-4 bg-muted/20 hover:bg-muted/30 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold truncate" title={m.title}>{m.title}</h3>
                                <Badge variant="outline" className="text-[10px] h-4 bg-primary/10 text-primary border-0">
                                    {m.status.replace(/_/g, ' ')}
                                </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                                <span className="font-medium text-foreground">Project:</span> {m.projectName}
                            </p>

                            {/* Progress Section */}
                            <div className="space-y-1.5 mb-4">
                                <div className="flex justify-between text-[10px] font-medium">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span>{m.totalTasks > 0 ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500 ease-in-out"
                                        style={{ width: `${m.totalTasks > 0 ? (m.completedTasks / m.totalTasks) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {m.completedTasks} / {m.totalTasks} tasks completed
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-auto pt-2 border-t">
                                <div className="text-xs">
                                    <span className="text-muted-foreground">Due: </span>
                                    <span className={`font-medium ${new Date(m.dueDate) < new Date() ? 'text-red-500' : 'text-foreground'}`}>
                                        {new Date(m.dueDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <Link href={`/projects?id=${m.projectId}`} className="text-[10px] uppercase font-bold text-primary hover:underline">
                                    Details
                                </Link>
                            </div>
                        </div>
                    ))}
                    {milestones.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            No upcoming milestones found.
                        </div>
                    )}
                </div>
            </Card>


            {/* Pending Access Requests */}
            {pendingAccessProjects.length > 0 && (
                <Card className="p-6 border-red-200 bg-red-50/10">
                    <h2 className="text-xl font-semibold mb-4 text-red-700">⚠️ Pending Access Requests</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pendingAccessProjects.map((p: any) => {
                            const pendingCount = Number(p.pendingAccessCount || 0);
                            return (
                                <Link key={p.id} href={`/projects?id=${p.id}`} className="block">
                                    <div className="border border-red-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                        <h3 className="font-semibold">{p.name}</h3>
                                        <p className="text-sm text-red-600 mb-2">{pendingCount} request{pendingCount > 1 ? 's' : ''} pending</p>
                                        <div className="text-xs text-primary font-medium flex items-center justify-end">
                                            View Details →
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Team Availability */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Members */}
                <Card className="p-6 border-l-4 border-l-green-500">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span>🟢</span> Available Team Members
                    </h2>
                    <div className="space-y-3">
                        {teamWorkload.filter((u: any) => u.activeProjects.length === 0).length > 0 ? (
                            teamWorkload.filter((u: any) => u.activeProjects.length === 0).map((u: any) => (
                                <div key={u.id} className="flex items-center justify-between p-3 bg-green-50/10 rounded-lg border border-green-100/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 font-bold text-xs">
                                            {u.profilePicture ? (
                                                <img src={u.profilePicture} alt={u.name} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                u.name.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{u.name}</p>
                                            <p className="text-xs text-muted-foreground">{u.role}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                        Free
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-sm italic">Everyone is currently busy!</p>
                        )}
                    </div>
                </Card>

                {/* Busy Members */}
                <Card className="p-6 border-l-4 border-l-orange-500">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span>🔴</span> Busy Team Members
                    </h2>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {teamWorkload.filter((u: any) => u.activeProjects.length > 0).length > 0 ? (
                            teamWorkload.filter((u: any) => u.activeProjects.length > 0).map((u: any) => (
                                <div key={u.id} className="p-3 bg-orange-50/5 rounded-lg border border-orange-100/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-700 dark:text-orange-300 font-bold text-xs">
                                                {u.profilePicture ? (
                                                    <img src={u.profilePicture} alt={u.name} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    u.name.charAt(0)
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{u.name}</p>
                                                <p className="text-xs text-muted-foreground">{u.activeProjects.length} Active Project{u.activeProjects.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1 ml-11">
                                        {u.activeProjects.map((p: any) => (
                                            <Link key={p.id} href={`/projects?id=${p.id}`} className="block text-xs text-primary hover:underline truncate">
                                                • {p.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground text-sm italic">No one is currently working on active projects.</p>
                        )}
                    </div>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Tasks</h2>
                <div className="space-y-3">
                    {recentTasks.length > 0 ? (
                        recentTasks.map((task: any) => (
                            <Link key={task.id} href="/tasks" className="block group">
                                <div
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group-hover:bg-muted transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-2 h-2 rounded-full ${task.status === 'done'
                                                ? 'bg-green-500'
                                                : task.status === 'in_progress'
                                                    ? 'bg-yellow-500'
                                                    : task.status === 'blocked'
                                                        ? 'bg-red-500'
                                                        : 'bg-gray-500'
                                                }`}
                                        />
                                        <div>
                                            <p className="font-medium">{task.title}</p>
                                            <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                                                {task.status?.replace('_', ' ')} • {task.priority} priority
                                            </p>
                                        </div>
                                    </div>
                                    {task.dueDate && (
                                        <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                                            {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-8">
                            No tasks yet. Create your first task to get started!
                        </p>
                    )}
                </div>
            </Card>
        </div>
    );
}
