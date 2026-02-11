'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { tasksApi } from '@/lib/api/tasks';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import api from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    const myTasks = tasks.filter((t: any) => t.assignedUserId === user?.id);
    const todoTasks = myTasks.filter((t: any) => t.status === 'todo' || t.status === 'in_progress');
    const activeProjects = projects.filter((p: any) => p.status === 'active');
    const hoursToday = attendanceStatus?.workDuration
        ? Math.floor(attendanceStatus.workDuration / 60)
        : 0;

    const teamWorkload = users.map((u: any) => ({
        ...u,
        activeProjects: projects.filter((p: any) => p.assignedUserId === u.id && p.status === 'active')
    }));

    const pendingAccessProjects = projects.filter((p: any) => {
        const pendingCount = Number(p.pendingAccessCount || 0);
        const hasPending = pendingCount > 0;
        if (!hasPending) return false;
        if (user?.role === 'admin') return true;
        return p.assignedUserId === user?.id || p.managerId === user?.id;
    });

    // Recent activity
    const recentTasks = tasks
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);

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

                <Link href="/users" className="block">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-transparent hover:border-primary/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Team</p>
                                <p className="text-3xl font-bold mt-2">{users.length}</p>
                                <p className="text-xs text-muted-foreground mt-1">members</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <span className="text-2xl">👥</span>
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

            {/* Admin Team Workload */}
            {isAdmin && (
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <span>👥</span> Team Workload & Active Projects
                    </h2>
                    <div className="space-y-6">
                        {teamWorkload.filter((u: any) => u.activeProjects.length > 0).map((u: any) => (
                            <div key={u.id} className="border rounded-xl p-4 bg-muted/20">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                            {u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold">{u.name}</p>
                                            <p className="text-xs text-muted-foreground">{u.role} • {u.activeProjects.length} active project{u.activeProjects.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {u.activeProjects.map((p: any) => (
                                        <div key={p.id} className="bg-white dark:bg-slate-900 border rounded-lg p-3 shadow-sm flex flex-col justify-between group">
                                            <div className="flex justify-between items-start mb-2">
                                                <Link href={`/projects?id=${p.id}`} className="font-semibold hover:text-primary transition-colors underline-offset-4 hover:underline">
                                                    {p.name}
                                                </Link>
                                                <Badge variant="outline" className={`${projectStatuses.find(s => s.value === p.status)?.color} text-white border-0 text-[10px] px-1.5 h-4 capitalize whitespace-nowrap`}>
                                                    {p.status.replace(/_/g, ' ')}
                                                </Badge>
                                            </div>

                                            <div className="mt-3 pt-3 border-t">
                                                <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block mb-1">Update Status</label>
                                                <Select
                                                    value={p.status}
                                                    onValueChange={(val) => handleStatusChange(p.id, val)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-muted/50 border-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {projectStatuses.map(status => (
                                                            <SelectItem key={status.value} value={status.value} className="text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                                                    {status.label}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

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
