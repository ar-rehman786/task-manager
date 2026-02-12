'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Save, Trash2, ChevronLeft, Download } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ideationApi } from '@/lib/api/ideation';
import Link from 'next/link';

interface StickyNote {
    id: string;
    text: string;
    color: string;
    x: number;
    y: number;
}

interface StickyNotesProps {
    id: number;
    initialData: any;
    name: string;
}

const COLORS = ['bg-yellow-100', 'bg-blue-100', 'bg-green-100', 'bg-pink-100', 'bg-purple-100'];

export function StickyNotes({ id, initialData, name }: StickyNotesProps) {
    const queryClient = useQueryClient();
    const [notes, setNotes] = useState<StickyNote[]>(initialData?.notes || []);

    const updateMutation = useMutation({
        mutationFn: (data: any) => ideationApi.updateBoard(id, { data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_board', id] });
        },
    });

    const handleSave = () => {
        updateMutation.mutate({ notes });
    };

    const addNote = () => {
        const newNote: StickyNote = {
            id: `note-${Date.now()}`,
            text: '',
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            x: 20 + (notes.length * 20) % 200,
            y: 20 + (notes.length * 20) % 200,
        };
        setNotes([...notes, newNote]);
    };

    const updateNote = (noteId: string, text: string) => {
        setNotes(notes.map(n => n.id === noteId ? { ...n, text } : n));
    };

    const deleteNote = (noteId: string) => {
        setNotes(notes.filter(n => n.id !== noteId));
    };

    return (
        <div className="h-[calc(100vh-12rem)] w-full relative border rounded-xl overflow-hidden shadow-inner bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] bg-white p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold">{name}</h2>
                    <p className="text-sm text-muted-foreground">Double click a note to type. Use "Save" to persist changes.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/ideation">
                        <Button variant="outline"><ChevronLeft size={16} className="mr-2" /> Back</Button>
                    </Link>
                    <Button onClick={addNote}><Plus size={16} className="mr-2" /> Add Sticky</Button>
                    <Button onClick={handleSave} disabled={updateMutation.isPending}>
                        <Save size={16} className="mr-2" /> {updateMutation.isPending ? 'Saving...' : 'Save Board'}
                    </Button>
                </div>
            </div>

            <div className="relative w-full h-full flex flex-wrap gap-6 items-start overflow-auto pb-20">
                {notes.length === 0 && (
                    <div className="w-full text-center py-20 opacity-30">
                        <Plus size={64} className="mx-auto mb-4" />
                        <p className="text-xl font-medium">Click "Add Sticky" to start brainstorming</p>
                    </div>
                )}
                {notes.map((note) => (
                    <StickyNoteItem
                        key={note.id}
                        note={note}
                        onUpdate={updateNote}
                        onDelete={deleteNote}
                    />
                ))}
            </div>
        </div>
    );
}

function StickyNoteItem({ note, onUpdate, onDelete }: { note: StickyNote, onUpdate: (id: string, text: string) => void, onDelete: (id: string) => void }) {
    const [localText, setLocalText] = useState(note.text);

    return (
        <Card
            className={`w-48 h-48 p-4 shadow-md border-none relative group transition-transform hover:rotate-1 ${note.color} flex flex-col`}
        >
            <textarea
                className="w-full h-full bg-transparent border-none resize-none focus:ring-0 text-sm font-medium leading-relaxed placeholder:text-black/20"
                placeholder="Type your idea here..."
                value={localText}
                onChange={(e) => {
                    setLocalText(e.target.value);
                    onUpdate(note.id, e.target.value);
                }}
            />
            <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => onDelete(note.id)}
            >
                <Trash2 size={12} />
            </Button>
        </Card>
    );
}
