'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { usersApi } from '@/lib/api/users';
import { Task, Project, Milestone, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/rich-text-editor';

interface TaskDialogProps {
    task?: Task | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Partial<Task>) => void;
    userRole?: string;
}

export function TaskDialog({ task, open, onOpenChange, onSubmit, userRole }: TaskDialogProps) {
    const [formData, setFormData] = useState<Partial<Task>>({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        assignedUserId: undefined,
        projectId: undefined,
        milestoneId: undefined,
        dueDate: '',
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
        queryKey: ['milestones', formData.projectId],
        queryFn: () => (formData.projectId ? projectsApi.getMilestones(formData.projectId) : Promise.resolve([])),
        enabled: !!formData.projectId,
    });

    useEffect(() => {
        if (task) {
            setFormData({
                ...task,
                dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            });
        } else {
            setFormData({
                title: '',
                description: '',
                status: 'todo',
                priority: 'medium',
                assignedUserId: undefined,
                projectId: undefined,
                milestoneId: undefined,
                dueDate: '',
            });
        }
    }, [task, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[min(900px,calc(100vw-40px))] max-h-[calc(100vh-32px)] w-full flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-4 lg:p-6 pb-2 border-b border-border dark:border-white/[0.08] flex-none bg-background z-20">
                    <DialogTitle className="text-xl lg:text-2xl font-bold truncate pr-8">{task ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                </DialogHeader>
                <form 
                    onSubmit={handleSubmit} 
                    className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 custom-scrollbar break-words"
                    style={{ wordBreak: 'break-word' }}
                >
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Support formatting & images)</Label>
                        <RichTextEditor
                            content={formData.description || ''}
                            onChange={(content) => setFormData({ ...formData, description: content })}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <select
                                id="status"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="blocked">Blocked</option>
                                <option value="done">Done</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <select
                                id="priority"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="assignedUserId">Assignee</Label>
                            <select
                                id="assignedUserId"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.assignedUserId || ''}
                                onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value ? Number(e.target.value) : undefined })}
                            >
                                <option value="">Unassigned</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dueDate">Due Date</Label>
                            <Input
                                id="dueDate"
                                type="date"
                                className="w-full"
                                value={formData.dueDate}
                                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="projectId">Project</Label>
                            <select
                                id="projectId"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.projectId || ''}
                                onChange={(e) => setFormData({ ...formData, projectId: e.target.value ? Number(e.target.value) : undefined, milestoneId: undefined })}
                            >
                                <option value="">No Project</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="milestoneId">Milestone</Label>
                            <select
                                id="milestoneId"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.milestoneId || ''}
                                onChange={(e) => setFormData({ ...formData, milestoneId: e.target.value ? Number(e.target.value) : undefined })}
                                disabled={!formData.projectId}
                            >
                                <option value="">No Milestone</option>
                                {milestones.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {formData.status === 'done' && (
                        <div className="space-y-4 pt-6 last:pb-0 border-t border-dashed">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="workflowLink">Workflow Link <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                                    <Input
                                        id="workflowLink"
                                        placeholder="https://workflow.com/..."
                                        value={formData.workflowLink || ''}
                                        onChange={(e) => setFormData({ ...formData, workflowLink: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="workflowStatus">Workflow Status <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                                    <Input
                                        id="workflowStatus"
                                        placeholder="Brief summary of work done"
                                        value={formData.workflowStatus || ''}
                                        onChange={(e) => setFormData({ ...formData, workflowStatus: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loomVideo">Loom Video (Optional)</Label>
                                <Input
                                    id="loomVideo"
                                    placeholder="https://loom.com/..."
                                    value={formData.loomVideo || ''}
                                    onChange={(e) => setFormData({ ...formData, loomVideo: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </form>
                <DialogFooter className="p-4 lg:p-6 pt-2 border-t border-border dark:border-white/[0.08] bg-muted/20 flex-none z-10">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="submit" onClick={() => (document.querySelector('form') as HTMLFormElement)?.requestSubmit()}>
                        {task ? 'Update Task' : 'Create Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
