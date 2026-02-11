'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ideationApi } from '@/lib/api/ideation';
import { projectsApi } from '@/lib/api/projects';
import { IdeationBoard } from '@/lib/types';

interface IdeationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    board: IdeationBoard | null;
}

export function IdeationDialog({ open, onOpenChange, board }: IdeationDialogProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        projectId: '',
        type: 'mindmap' as 'mindmap' | 'stickies',
    });

    useEffect(() => {
        if (board) {
            setFormData({
                name: board.name,
                projectId: board.projectId?.toString() || '',
                type: board.type,
            });
        } else {
            setFormData({
                name: '',
                projectId: '',
                type: 'mindmap',
            });
        }
    }, [board, open]);

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getProjects,
    });

    const createMutation = useMutation({
        mutationFn: ideationApi.createBoard,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_boards'] });
            onOpenChange(false);
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: any }) => ideationApi.updateBoard(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_boards'] });
            onOpenChange(false);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            name: formData.name,
            projectId: formData.projectId ? parseInt(formData.projectId) : undefined,
            type: formData.type,
        };

        if (board) {
            updateMutation.mutate({ id: board.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{board ? 'Edit Board' : 'New Ideation Board'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Board Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. n8n Customer Onboarding Workflow"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Assigned Project</Label>
                        <Select
                            value={formData.projectId}
                            onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a project (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {projects?.map((project) => (
                                    <SelectItem key={project.id} value={project.id.toString()}>
                                        {project.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Board Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                            disabled={!!board}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mindmap">Mind Map (Concept Visualizer)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                            {board ? 'Save Changes' : 'Create Board'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
