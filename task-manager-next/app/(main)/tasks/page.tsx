'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { Task, User, Board } from '@/lib/types';
import { TaskDialog } from '@/components/tasks/task-dialog';
import { TaskCompletionModal } from '@/components/tasks/task-completion-modal';
import { useAuthStore } from '@/lib/store/authStore';
import { Button } from '@/components/ui/button';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { Trash2, ClipboardList, Flag, Circle } from 'lucide-react';
import { toast } from 'sonner';

export default function TasksPage() {
    return (
        <ProtectedRoute>
            <TasksContent />
        </ProtectedRoute>
    );
}

function TasksContent() {
    const queryClient = useQueryClient();
    const [currentBoardId, setCurrentBoardId] = useState<number | null>(null);
    const [filters, setFilters] = useState({ assignee: 'all', status: 'all', priority: 'all' });
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ id: number; status: string } | null>(null);
    const userRole = useAuthStore((state) => state.user?.role);

    const TaskDescription = ({ description }: { description: string }) => {
        const maxLength = 200;
        const needsTruncation = description.length > maxLength;
        const displayContent = needsTruncation ? description.substring(0, maxLength) + '...' : description;

        return (
            <div
                className="text-sm text-muted-foreground mb-2 line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: displayContent }}
            />
        );
    };

    // Fetch tasks, boards, and users
    const { data: tasks = [], isLoading: tasksLoading } = useQuery({
        queryKey: ['tasks'],
        queryFn: tasksApi.getTasks,
    });

    const { data: boards = [], isLoading: boardsLoading } = useQuery({
        queryKey: ['boards'],
        queryFn: async () => {
            const response = await api.get<Board[]>('/api/boards');
            return response.data;
        },
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.getUsers,
    });

    // Set first board as active
    useEffect(() => {
        if (boards.length > 0 && !currentBoardId) {
            setCurrentBoardId(boards[0].id);
        }
    }, [boards, currentBoardId]);

    // Mutations
    const updateTaskMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Task> }) =>
            tasksApi.updateTask(id, data),
        onMutate: async ({ id, data }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['tasks'] });

            // Snapshot the previous value
            const previousTasks = queryClient.getQueryData(['tasks']);

            // Optimistically update to the new value
            queryClient.setQueryData(['tasks'], (old: Task[] | undefined) => {
                if (!old) return [];
                return old.map((t) => (t.id === id ? { ...t, ...data } : t));
            });

            // Return a context object with the snapshotted value
            return { previousTasks };
        },
        onSuccess: (updatedTask) => {
            // Directly update the cache with the strictly saved version from server
            queryClient.setQueryData(['tasks'], (old: Task[] | undefined) => {
                if (!old) return [updatedTask];
                return old.map((t) => (t.id === updatedTask.id ? updatedTask : t));
            });
            toast.success('Task saved successfully');
        },
        onError: (err, variables, context) => {
            // Roll back to previous state on error
            if (context?.previousTasks) {
                queryClient.setQueryData(['tasks'], context.previousTasks);
            }
            toast.error('Failed to save task. Please try again.');
        },
        onSettled: () => {
            // Always refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            // Refetch users so availability (isBusy/isAvailable) updates live
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setShowTaskModal(false);
            setSelectedTask(null);
            setShowCompletionModal(false);
            setPendingStatusUpdate(null);
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: (data: Partial<Task>) => tasksApi.createTask(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setShowTaskModal(false);
        },
    });

    const deleteTaskMutation = useMutation({
        mutationFn: (id: number) => tasksApi.deleteTask(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            toast.success('Task deleted successfully');
        },
        onError: () => {
            toast.error('Failed to delete task');
        }
    });

    const handleDeleteTask = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this task?')) {
            deleteTaskMutation.mutate(id);
        }
    };

    // Filter tasks
    const filteredTasks = useMemo(() => tasks.filter((task) => {
        const currentBoard = boards.find((b) => b.id === currentBoardId);

        // Fallback: If no board is selected or found, show all tasks (useful for admins or initial state)
        if (!currentBoard) {
            // Basic filtering still applies
            if (filters.assignee !== 'all' && task.assignedUserId?.toString() !== filters.assignee) return false;
            if (filters.status !== 'all' && task.status !== filters.status) return false;
            if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
            return true;
        }

        //  Board filtering
        if (currentBoard.type === 'MEMBER_BOARD' && task.assignedUserId !== currentBoard.ownerUserId) {
            return false;
        }

        // User filters
        if (filters.assignee !== 'all' && task.assignedUserId?.toString() !== filters.assignee) {
            return false;
        }
        if (filters.status !== 'all' && task.status !== filters.status) {
            return false;
        }
        if (filters.priority !== 'all' && task.priority !== filters.priority) {
            return false;
        }

        return true;
    }), [tasks, boards, currentBoardId, filters]);

    // Group tasks by status
    const columns = useMemo(() => [
        { id: 'todo', title: 'To Do', color: '#6366f1' },
        { id: 'in_progress', title: 'In Progress', color: '#f59e0b' },
        { id: 'blocked', title: 'Blocked', color: '#ef4444' },
        { id: 'done', title: 'Done', color: '#10b981' },
    ], []);

    const tasksByStatus = useMemo(() => columns.reduce((acc, col) => {
        acc[col.id] = filteredTasks.filter((t) => t.status === col.id);
        return acc;
    }, {} as Record<string, Task[]>), [columns, filteredTasks]);

    // Compute availability from tasks directly (don't rely on server-side flags)
    const memberUsers = useMemo(() => users.filter(u => u.role === 'member' || !u.role), [users]);

    const busyUserIds = useMemo(() => {
        const ids = new Set<number>();
        tasks.forEach(t => {
            if ((t.status === 'todo' || t.status === 'in_progress') && t.assignedUserId) {
                ids.add(t.assignedUserId);
            }
        });
        return ids;
    }, [tasks]);

    const activeTaskCountMap = useMemo(() => {
        const map: Record<number, number> = {};
        tasks.forEach(t => {
            if ((t.status === 'todo' || t.status === 'in_progress') && t.assignedUserId) {
                map[t.assignedUserId] = (map[t.assignedUserId] || 0) + 1;
            }
        });
        return map;
    }, [tasks]);

    const availableUsers = useMemo(() => users.filter(u => !busyUserIds.has(u.id)), [users, busyUserIds]);
    const busyUsers = useMemo(() => users.filter(u => busyUserIds.has(u.id)), [users, busyUserIds]);

    // Drag and drop handlers
    const handleDragStart = (taskId: number) => {
        setDraggedTaskId(taskId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleStatusUpdate = (taskId: number, newStatus: string) => {
        const task = tasks.find((t) => t.id === taskId);
        if (!task) return;

        // Validation for members moving to 'done'
        if (newStatus === 'done' && task.status !== 'done' && userRole === 'member') {
            setPendingStatusUpdate({ id: taskId, status: newStatus });
            setShowCompletionModal(true);
        } else {
            updateTaskMutation.mutate({
                id: taskId,
                data: { ...task, status: newStatus as any },
            });
        }
    };

    const handleDrop = (status: string) => {
        if (!draggedTaskId) return;
        handleStatusUpdate(draggedTaskId, status);
        setDraggedTaskId(null);
    };

    const handleTaskSubmit = (data: Partial<Task>) => {
        if (selectedTask) {
            updateTaskMutation.mutate({ id: selectedTask.id, data });
        } else {
            createTaskMutation.mutate(data);
        }
    };

    const handleCompletionConfirm = (details: { workflowLink: string; workflowStatus: string; loomVideo?: string }) => {
        if (!pendingStatusUpdate) return;

        const task = tasks.find((t) => t.id === pendingStatusUpdate.id);
        if (!task) return;

        updateTaskMutation.mutate({
            id: pendingStatusUpdate.id,
            data: {
                ...task,
                status: pendingStatusUpdate.status as Task['status'],
                ...details
            },
        });
    };

    if (tasksLoading || boardsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-5 p-4 lg:p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Tasks</h1>
                <Button onClick={() => setShowTaskModal(true)} size="sm" className="gap-2">
                    <ClipboardList className="w-4 h-4" /> New Task
                </Button>
            </div>

            {/* Team Availability — simple inline row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground font-medium">Available:</span>
                {availableUsers.length > 0 ? availableUsers.map(u => (
                    <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                        <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500 flex-shrink-0" />
                        {u.name}
                    </span>
                )) : <span className="text-muted-foreground text-xs">—</span>}
                <span className="text-border">|</span>
                <span className="text-muted-foreground font-medium">Busy:</span>
                {busyUsers.length > 0 ? busyUsers.map(u => (
                    <span key={u.id} className="flex items-center gap-1 text-amber-600 font-medium">
                        <Circle className="w-1.5 h-1.5 fill-amber-500 text-amber-500 inline-block" />
                        {u.name}
                        <span className="text-xs text-muted-foreground">({activeTaskCountMap[u.id] || 0})</span>
                    </span>
                )) : <span className="text-muted-foreground text-xs">—</span>}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <select
                    className="px-3 py-1.5 border rounded-md bg-background text-sm"
                    value={filters.assignee}
                    onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                >
                    <option value="all">All Members</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
                <select
                    className="px-3 py-1.5 border rounded-md bg-background text-sm"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                    <option value="all">All Statuses</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                </select>
                <select
                    className="px-3 py-1.5 border rounded-md bg-background text-sm"
                    value={filters.priority}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                >
                    <option value="all">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </div>

            {/* Board Tabs */}
            <div className="flex gap-1 border-b border-border dark:border-white/[0.08] overflow-x-auto">
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        currentBoardId === null ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => setCurrentBoardId(null)}
                >All Tasks</button>
                {boards.filter(b => b.type !== 'ALL_TASKS').map((board) => (
                    <button
                        key={board.id}
                        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                            currentBoardId === board.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setCurrentBoardId(board.id)}
                    >{board.name}</button>
                ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {columns.map((col) => (
                    <div
                        key={col.id}
                        className="flex flex-col gap-3"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(col.id)}
                    >
                        {/* Column header */}
                        <div
                            className="flex items-center justify-between pb-2 border-b-2 dark:opacity-50"
                            style={{ borderColor: col.color }}
                        >
                            <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                                {tasksByStatus[col.id]?.length || 0}
                            </span>
                        </div>

                        {/* Cards */}
                        <div className="space-y-2.5">
                            {tasksByStatus[col.id]?.map((task) => {
                                const isOverdue = task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date();
                                const assignedUser = users.find(u => u.id === task.assignedUserId);
                                return (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={() => handleDragStart(task.id)}
                                        onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}
                                        className="bg-card border border-border rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
                                    >
                                            {/* Title + priority + delete */}
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h4 className="text-sm font-medium leading-snug line-clamp-2 flex-1">{task.title}</h4>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                {isOverdue && (
                                                    <span className="text-[10px] font-semibold text-red-500">Overdue</span>
                                                )}
                                                <span className={`text-[10px] font-semibold capitalize ${
                                                    task.priority === 'high' ? 'text-red-500' :
                                                    task.priority === 'medium' ? 'text-amber-500' :
                                                    'text-emerald-600'}`}>{task.priority}</span>
                                                <button
                                                    onClick={(e) => handleDeleteTask(e, task.id)}
                                                    className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {task.description && <TaskDescription description={task.description} />}

                                        {/* Project / Milestone */}
                                        {(task.projectName || task.milestoneTitle) && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {task.projectName && (
                                                    <span className="text-[10px] text-primary bg-primary/8 px-1.5 py-0.5 rounded">{task.projectName}</span>
                                                )}
                                                {task.milestoneTitle && (
                                                    <span className="text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <Flag className="w-2.5 h-2.5" /> {task.milestoneTitle}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer: assignee + status */}
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                            <div className="flex items-center gap-1.5">
                                                {assignedUser ? (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                                                            {assignedUser.name.charAt(0)}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">{assignedUser.name.split(' ')[0]}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Unassigned</span>
                                                )}
                                            </div>
                                            <select
                                                value={task.status}
                                                onChange={(e) => { e.stopPropagation(); handleStatusUpdate(task.id, e.target.value); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-background text-muted-foreground cursor-pointer"
                                            >
                                                {columns.map(c => (
                                                    <option key={c.id} value={c.id}>{c.title}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Due date */}
                                        {task.dueDate && (
                                            <p className={`text-[10px] mt-1.5 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`} suppressHydrationWarning>
                                                Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <TaskDialog
                open={showTaskModal}
                onOpenChange={(open) => {
                    setShowTaskModal(open);
                    if (!open) setSelectedTask(null);
                }}
                task={selectedTask}
                onSubmit={handleTaskSubmit}
                userRole={userRole}
            />

            <TaskCompletionModal
                open={showCompletionModal}
                onOpenChange={setShowCompletionModal}
                onConfirm={handleCompletionConfirm}
                isSubmitting={updateTaskMutation.isPending}
            />
        </div>
    );
}
