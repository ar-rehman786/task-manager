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
    isSubmitting?: boolean;
}

export function TaskCompletionModal({ open, onOpenChange, onConfirm, isSubmitting }: TaskCompletionModalProps) {
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
                        All fields are optional — fill in what's available.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="workflowLink">Workflow Link <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                        <Input
                            id="workflowLink"
                            placeholder="https://..."
                            value={formData.workflowLink}
                            onChange={(e) => setFormData({ ...formData, workflowLink: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workflowStatus">Workflow Status <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                        <Input
                            id="workflowStatus"
                            placeholder="e.g. Completed, Pending Review"
                            value={formData.workflowStatus}
                            onChange={(e) => setFormData({ ...formData, workflowStatus: e.target.value })}
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
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Complete Task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
