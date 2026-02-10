'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TaskCompletionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (data: { workflowLink: string; workflowStatus: string; loomVideo?: string }) => void;
}

export function TaskCompletionModal({ open, onOpenChange, onConfirm }: TaskCompletionModalProps) {
    const [formData, setFormData] = useState({
        workflowLink: '',
        workflowStatus: '',
        loomVideo: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Complete Task</DialogTitle>
                    <DialogDescription>
                        Please provide the details below to complete this task.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="workflowLink">Workflow Link *</Label>
                        <Input
                            id="workflowLink"
                            placeholder="https://..."
                            value={formData.workflowLink}
                            onChange={(e) => setFormData({ ...formData, workflowLink: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workflowStatus">Workflow Status *</Label>
                        <Input
                            id="workflowStatus"
                            placeholder="e.g. Completed, Pending Review"
                            value={formData.workflowStatus}
                            onChange={(e) => setFormData({ ...formData, workflowStatus: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="loomVideo">Loom Video (Optional)</Label>
                        <Input
                            id="loomVideo"
                            placeholder="https://loom.com/..."
                            value={formData.loomVideo}
                            onChange={(e) => setFormData({ ...formData, loomVideo: e.target.value })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Complete Task</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
