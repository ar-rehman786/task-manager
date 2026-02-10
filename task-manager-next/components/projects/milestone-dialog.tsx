"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RichTextEditor } from "@/components/rich-text-editor"

interface MilestoneDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { title: string; dueDate?: string; status: string; details?: string }) => void
}

export function MilestoneDialog({ open, onOpenChange, onSubmit }: MilestoneDialogProps) {
    const [title, setTitle] = useState("")
    const [dueDate, setDueDate] = useState("")
    const [status, setStatus] = useState("not_started")
    const [details, setDetails] = useState("")

    const onSubmitClick = () => {
        if (!title) return;
        onSubmit({ title, dueDate, status, details });
        onOpenChange(false);
        setTitle("");
        setDueDate("");
        setStatus("not_started");
        setDetails("");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Milestone</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="title" className="text-sm font-medium">Title</label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milestone title" />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="dueDate" className="text-sm font-medium">Due Date</label>
                        <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="status" className="text-sm font-medium">Status</label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="done">Done</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="details" className="text-sm font-medium">Details (Support formatting & images)</label>
                        <RichTextEditor
                            content={details}
                            onChange={setDetails}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onSubmitClick}>Add Milestone</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
