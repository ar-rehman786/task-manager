'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Project } from '@/lib/types';
import { usersApi } from '@/lib/api/users';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface ProjectDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project?: Project | null;
    onSubmit: (data: Partial<Project>) => Promise<void>;
}

export function ProjectDialog({
    open,
    onOpenChange,
    project,
    onSubmit,
}: ProjectDialogProps) {
    const [name, setName] = useState('');
    const [client, setClient] = useState('');
    const [status, setStatus] = useState<Project['status']>('active');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [description, setDescription] = useState('');
    const [managerId, setManagerId] = useState<string>('');
    const [assignedUserId, setAssignedUserId] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.getUsers,
    });

    useEffect(() => {
        if (open) {
            if (project) {
                setName(project.name);
                setClient(project.client || '');
                setStatus(project.status);
                setStartDate(
                    project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : ''
                );
                setEndDate(
                    project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : ''
                );
                setDescription(project.description || '');
                setManagerId(project.managerId?.toString() || '');
                setAssignedUserId(project.assignedUserId?.toString() || '');
            } else {
                // Reset for new project
                setName('');
                setClient('');
                setStatus('active');
                setStartDate(new Date().toISOString().split('T')[0]);
                setEndDate('');
                setDescription('');
                setManagerId('');
                setAssignedUserId('');
            }
        }
    }, [open, project]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSubmit({
                name,
                client,
                status,
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                endDate: endDate ? new Date(endDate).toISOString() : undefined,
                description,
                managerId: managerId ? parseInt(managerId) : undefined,
                assignedUserId: assignedUserId ? parseInt(assignedUserId) : undefined,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save project:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="client">Client</Label>
                        <Input
                            id="client"
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={status}
                            onValueChange={(value: any) => setStatus(value)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="manager">Project Manager</Label>
                            <Select
                                value={managerId}
                                onValueChange={setManagerId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Manager" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="assignedUser">Assigned Member</Label>
                            <Select
                                value={assignedUserId}
                                onValueChange={setAssignedUserId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id.toString()}>
                                            {user.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Project'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
