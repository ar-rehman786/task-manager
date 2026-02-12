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
        onError: (err, variables, context) => {
            // Roll back to previous state on error
            if (context?.previousTasks) {
                queryClient.setQueryData(['tasks'], context.previousTasks);
            }
        },
        onSettled: () => {
            // Always refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
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

    // Filter tasks
    const filteredTasks = useMemo(() => tasks.filter((task) => {
        const currentBoard = boards.find((b) => b.id === currentBoardId);
        if (!currentBoard) return false;

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

    const handleDrop = (status: string) => {
        if (!draggedTaskId) return;

        const task = tasks.find((t) => t.id === draggedTaskId);
        if (!task) return;

        // Validation for members moving to 'done'
        if (status === 'done' && task.status !== 'done' && userRole === 'member') {
            setPendingStatusUpdate({ id: draggedTaskId, status });
            setShowCompletionModal(true);
        } else {
            updateTaskMutation.mutate({
                id: draggedTaskId,
                data: { ...task, status: status as any },
            });
        }

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
        <div className="p-6 space-y-6">
            {/*  Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Tasks</h1>
                <Button onClick={() => setShowTaskModal(true)}>+ Quick Add Task</Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <select
                    className="px-4 py-2 border rounded-lg bg-background"
                    value={filters.assignee}
                    onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                >
                    <option value="all">All Members</option>
                    {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                    ))}
                </select>

                <select
                    className="px-4 py-2 border rounded-lg bg-background"
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
                    className="px-4 py-2 border rounded-lg bg-background"
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
            <div className="flex gap-2 border-b">
                {boards.map((board) => (
                    <button
                        key={board.id}
                        className={`px-4 py-2 font-medium transition-colors ${currentBoardId === board.id
                            ? 'border-b-2 border-primary text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                        onClick={() => setCurrentBoardId(board.id)}
                    >
                        {board.name}
                    </button>
                ))}
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-4 gap-4">
                {columns.map((col) => (
                    <div
                        key={col.id}
                        className="bg-muted/30 rounded-lg p-4 min-h-[600px]"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(col.id)}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold" style={{ color: col.color }}>
                                {col.title}
                            </h3>
                            <span className="bg-background rounded-full px-2 py-1 text-xs font-medium">
                                {tasksByStatus[col.id]?.length || 0}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {tasksByStatus[col.id]?.map((task) => (
                                <div
                                    key={task.id}
                                    draggable
                                    onDragStart={() => handleDragStart(task.id)}
                                    onClick={() => {
                                        setSelectedTask(task);
                                        setShowTaskModal(true);
                                    }}
                                    className="bg-background p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow relative group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium group-hover:text-primary transition-colors">{task.title}</h4>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${task.priority === 'high'
                                                ? 'bg-red-500/20 text-red-600'
                                                : task.priority === 'medium'
                                                    ? 'bg-yellow-500/20 text-yellow-600'
                                                    : 'bg-green-500/20 text-green-600'
                                                }`}
                                        >
                                            {task.priority}
                                        </span>
                                    </div>

                                    {task.description && <TaskDescription description={task.description} />}

                                    <div className="space-y-1 mb-2">
                                        {task.projectName && (
                                            <div className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded inline-block">
                                                📁 {task.projectName}
                                            </div>
                                        )}
                                        {task.milestoneTitle && (
                                            <div className="text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded block">
                                                🎯 {task.milestoneTitle}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                            👤 {users.find((u) => u.id === task.assignedUserId)?.name || 'Unassigned'}
                                        </span>
                                        {task.dueDate && (
                                            <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
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
            />

            <TaskCompletionModal
                open={showCompletionModal}
                onOpenChange={setShowCompletionModal}
                onConfirm={handleCompletionConfirm}
            />
        </div>
    );
}
