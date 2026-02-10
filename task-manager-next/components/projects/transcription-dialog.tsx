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
import { Textarea } from "@/components/ui/textarea"

interface TranscriptionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { title: string; content: string }) => void
}

export function TranscriptionDialog({ open, onOpenChange, onSubmit }: TranscriptionDialogProps) {
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")

    const onSubmitClick = () => {
        if (!title) return;
        onSubmit({ title, content });
        onOpenChange(false);
        setTitle("");
        setContent("");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Meeting Transcription</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="title" className="text-sm font-medium">Title/Date</label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kickoff Meeting" />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="content" className="text-sm font-medium">Transcription Content</label>
                        <Textarea
                            id="content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Paste transcription here..."
                            className="h-64"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onSubmitClick}>Save Transcription</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
