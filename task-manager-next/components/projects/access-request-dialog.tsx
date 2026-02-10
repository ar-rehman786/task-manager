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

interface AccessRequestDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: { platform: string; description: string; notes: string }) => void
}

export function AccessRequestDialog({ open, onOpenChange, onSubmit }: AccessRequestDialogProps) {
    const [platform, setPlatform] = useState("")
    const [description, setDescription] = useState("")
    const [notes, setNotes] = useState("")

    const onSubmitClick = () => {
        if (!platform) return;
        onSubmit({ platform, description, notes });
        onOpenChange(false);
        setPlatform("");
        setDescription("");
        setNotes("");
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Request Client Access</DialogTitle>
                    <div className="text-sm text-muted-foreground">
                        Please provide details about the access you need.
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label htmlFor="platform" className="text-sm font-medium">Platform / Service</label>
                        <Input id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. AWS, GitHub, Stripe" />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="description" className="text-sm font-medium">Description</label>
                        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What access is needed?" />
                    </div>
                    <div className="grid gap-2">
                        <label htmlFor="notes" className="text-sm font-medium">Additional Notes</label>
                        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any specific requirements..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onSubmitClick}>Request Access</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
