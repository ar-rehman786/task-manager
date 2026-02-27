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
import { Trash2 } from 'lucide-react';
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
        <div className="h-full flex flex-col space-y-4 p-4 lg:p-6 overflow-hidden">
            {/* Header, Filters, Boards - Fixed Section */}
            <div className="flex-none space-y-4">
                {/*  Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl lg:text-3xl font-bold">Tasks</h1>
                    <Button onClick={() => setShowTaskModal(true)} className="w-full sm:w-auto">+ Quick Add Task</Button>
                </div>

                {/* Team Availability */}
                <div className="flex flex-wrap gap-3 items-start p-3 bg-muted/20 border rounded-lg">
                    {/* Available Members */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">✅ Available:</span>
                        {users.filter(u => u.isAvailable).length > 0 ? (
                            users.filter(u => u.isAvailable).map(u => (
                                <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-700 dark:text-green-400 rounded-full border border-green-200/50 text-[10px] font-bold">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    {u.name}
                                </div>
                            ))
                        ) : (
                            <span className="text-[10px] text-muted-foreground italic">None</span>
                        )}
                    </div>

                    <div className="w-px h-4 bg-border self-center" />

                    {/* Busy Members */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">🔴 Busy:</span>
                        {users.filter(u => u.isBusy).length > 0 ? (
                            users.filter(u => u.isBusy).map(u => (
                                <div key={u.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full border border-amber-200/50 text-[10px] font-bold" title={`${u.activeTaskCount} active task${u.activeTaskCount !== 1 ? 's' : ''}`}>
                                    <span className="relative flex h-2 w-2">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                    {u.name}
                                    <span className="bg-amber-500/20 rounded-full px-1 text-[9px]">{u.activeTaskCount}</span>
                                </div>
                            ))
                        ) : (
                            <span className="text-[10px] text-muted-foreground italic">None</span>
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <select
                        className="px-4 py-2 border rounded-lg bg-background font-medium text-sm flex-1 sm:flex-none"
                        value={filters.assignee}
                        onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                    >
                        <option value="all">👥 All Members</option>
                        {users.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.isAvailable ? '🟢 ' : '🔴 '}{u.name}{u.isBusy ? ` (${u.activeTaskCount} tasks)` : ''}
                            </option>
                        ))}
                    </select>

                    <select
                        className="px-4 py-2 border rounded-lg bg-background flex-1 sm:flex-none"
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
                        className="px-4 py-2 border rounded-lg bg-background flex-1 sm:flex-none min-w-[120px]"
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
                <div className="flex gap-2 border-b overflow-x-auto pb-px">
                    <button
                        className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${currentBoardId === null
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setCurrentBoardId(null)}
                    >
                        All Tasks
                    </button>
                    {boards.filter(b => b.type !== 'ALL_TASKS').map((board) => (
                        <button
                            key={board.id}
                            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap text-sm ${currentBoardId === board.id
                                ? 'border-b-2 border-primary text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                            onClick={() => setCurrentBoardId(board.id)}
                        >
                            {board.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Kanban Board - Scrollable columns Section */}
            <div className="flex-1 min-h-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full overflow-y-auto lg:overflow-hidden">
                    {columns.map((col) => (
                        <div
                            key={col.id}
                            className="bg-muted/30 rounded-lg flex flex-col h-full min-h-[300px] lg:min-h-0"
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(col.id)}
                        >
                            <div className="flex justify-between items-center p-4 pb-2 flex-none">
                                <h3 className="font-semibold text-sm" style={{ color: col.color }}>
                                    {col.title}
                                </h3>
                                <span className="bg-background rounded-full px-2 py-0.5 text-[10px] font-bold">
                                    {tasksByStatus[col.id]?.length || 0}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 pt-1 space-y-3 custom-scrollbar">
                                {tasksByStatus[col.id]?.map((task) => (
                                    <div
                                        key={task.id}
                                        draggable
                                        onDragStart={() => handleDragStart(task.id)}
                                        onClick={() => {
                                            setSelectedTask(task);
                                            setShowTaskModal(true);
                                        }}
                                        className={`relative bg-card rounded-xl shadow-sm border border-border cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group overflow-hidden
                                            ${task.priority === 'high' ? 'border-l-4 border-l-red-500' : task.priority === 'medium' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500'}
                                        `}
                                    >
                                        <div className="p-3.5">
                                            {/* Top row: title + badges */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <h4 className="font-semibold text-[13px] group-hover:text-primary transition-colors leading-snug flex-1 min-w-0 line-clamp-2">{task.title}</h4>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {task.dueDate && task.status !== 'done' && (() => {
                                                        const d = new Date(task.dueDate);
                                                        const today = new Date(); today.setHours(0,0,0,0);
                                                        return d < today;
                                                    })() && (
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-red-500 text-white animate-pulse">OD</span>
                                                    )}
                                                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                                        task.priority === 'high' ? 'bg-red-500/15 text-red-600' :
                                                        task.priority === 'medium' ? 'bg-amber-500/15 text-amber-600' :
                                                        'bg-emerald-500/15 text-emerald-600'}`}>
                                                        {task.priority}
                                                    </span>
                                                    <button
                                                        onClick={(e) => handleDeleteTask(e, task.id)}
                                                        className="p-1 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Description snippet */}
                                            {task.description && <TaskDescription description={task.description} />}

                                            {/* Project / Milestone chips */}
                                            {(task.projectName || task.milestoneTitle) && (
                                                <div className="flex flex-wrap gap-1 mb-2.5">
                                                    {task.projectName && (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                            <span>📁</span> {task.projectName}
                                                        </span>
                                                    )}
                                                    {task.milestoneTitle && (
                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full">
                                                            <span>🎯</span> {task.milestoneTitle}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Footer: assignee + status + date */}
                                            <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
                                                {/* Assignee */}
                                                <div className="flex items-center gap-1.5">
                                                    {(() => {
                                                        const u = users.find(u => u.id === task.assignedUserId);
                                                        if (!u) return <span className="text-[10px] text-muted-foreground">Unassigned</span>;
                                                        return (
                                                            <div className="flex items-center gap-1">
                                                                <div className="relative">
                                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-[9px] font-bold text-white">
                                                                        {u.name.charAt(0)}
                                                                    </div>
                                                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${u.isBusy ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                                </div>
                                                                <span className="text-[10px] font-medium text-foreground truncate max-w-[70px]">{u.name.split(' ')[0]}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Status select */}
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => { e.stopPropagation(); handleStatusUpdate(task.id, e.target.value); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[9px] font-bold uppercase bg-muted/60 border border-border rounded-full px-2 py-1 cursor-pointer hover:bg-muted focus:ring-1 focus:ring-primary outline-none transition-colors"
                                                >
                                                    {columns.map(col => (
                                                        <option key={col.id} value={col.id}>{col.title}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Due date row */}
                                            {task.dueDate && (
                                                <div className="flex items-center gap-1 mt-2" suppressHydrationWarning>
                                                    <span className="text-[10px]">📅</span>
                                                    <span className={`text-[10px] font-medium ${
                                                        (() => { const d = new Date(task.dueDate); const t = new Date(); t.setHours(0,0,0,0); return d < t && task.status !== 'done'; })()
                                                        ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                        {(() => { const d = new Date(task.dueDate); return isNaN(d.getTime()) ? 'Invalid' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }); })()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
