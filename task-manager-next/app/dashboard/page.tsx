'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { tasksApi } from '@/lib/api/tasks';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import api from '@/lib/api/client';

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <DashboardContent />
        </ProtectedRoute>
    );
}

function DashboardContent() {
    const user = useAuthStore((state) => state.user);
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
        queryFn: async () => {
            const response = await api.get('/api/attendance/status');
            return response.data;
        },
    });

    // Calculate stats
    const myTasks = tasks.filter((t) => t.assignedUserId === user?.id);
    const todoTasks = myTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
    const activeProjects = projects.filter((p) => p.status === 'active');
    const hoursToday = attendanceStatus?.workDuration
        ? Math.floor(attendanceStatus.workDuration / 60)
        : 0;

    // Recent activity
    const recentTasks = tasks
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);

    return (
        <div className="p-6 space-y-6">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-8">
                <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}! 👋</h1>
                <p className="text-lg opacity-90">{currentDate}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
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

                <Card className="p-6">
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

                <Card className="p-6">
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

                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Hours Today</p>
                            <p className="text-3xl font-bold mt-2">{hoursToday}h</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {attendanceStatus?.status === 'active' ? '🟢 Working' : 'Not clocked in'}
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <span className="text-2xl">⏱️</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Tasks</h2>
                <div className="space-y-3">
                    {recentTasks.length > 0 ? (
                        recentTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
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
                                        <p className="text-xs text-muted-foreground">
                                            {task.status?.replace('_', ' ')} • {task.priority} priority
                                        </p>
                                    </div>
                                </div>
                                {task.dueDate && (
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
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
