'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
    Bold, Italic, List, ListOrdered,
    Heading1, Heading2, Image as ImageIcon,
    Undo, Redo, Quote, AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

const SAFE_LIMIT = 200000; // 200k characters safety threshold

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const [isLargeContent] = useState(content.length > SAFE_LIMIT);
    const [isEditing, setIsEditing] = useState(!isLargeContent);
    const [isLoadingEditor, setIsLoadingEditor] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
        ],
        content: isEditing ? content : '',
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Handle switching to edit mode for large content
    const handleStartEditing = () => {
        setIsLoadingEditor(true);
        // Delay slightly to give UI feedback and avoid blocking the thread immediately
        setTimeout(() => {
            setIsEditing(true);
            setIsLoadingEditor(false);
            if (editor) {
                editor.commands.setContent(content);
            }
        }, 100);
    };

    useEffect(() => {
        if (editor && isEditing) {
            // setContent with emitUpdate=false skips triggering onUpdate,
            // so the initial load doesn't fire onChange → no accidental saves.
            editor.chain().setContent(content).run();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, isEditing]); // intentionally omit `content` — only sync on open

    const addImage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editor) return;

        const reader = new FileReader();
        reader.onload = () => {
            const base64Url = reader.result as string;
            if (base64Url) {
                editor.chain().focus().setImage({ src: base64Url }).run();
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    if (!isEditing) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Milestone Description Preview</span>
                        {isLargeContent && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                Safety Mode Active
                            </Badge>
                        )}
                    </div>
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-bold text-primary"
                        onClick={handleStartEditing}
                        disabled={isLoadingEditor}
                    >
                        {isLoadingEditor ? 'Initialising Editor...' : 'Click to Edit Description'}
                    </Button>
                </div>

                <div
                    className="min-h-[150px] overflow-y-auto p-6 border rounded-lg bg-muted/5 prose prose-sm dark:prose-invert max-w-none break-words"
                    dangerouslySetInnerHTML={{ __html: content || `<p class="text-muted-foreground italic">${placeholder || 'No description provided.'}</p>` }}
                />

                <p className="text-[10px] text-muted-foreground italic text-center py-2 border-t">
                    Showing instant visualization for large data. Click the button above to start editing.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Rich Text Editor</span>
                    {isLargeContent && (
                        <Badge variant="outline" className="text-[9px] h-4 bg-orange-500/10 text-orange-600 border-orange-500/20">
                            Large Document
                        </Badge>
                    )}
                </div>
            </div>

            <div className="border border-border dark:border-white/[0.1] rounded-md focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">
                <div className="flex flex-wrap gap-1 p-1 bg-muted/50 border-b border-border dark:border-white/[0.08] items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('bold') ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        title="Bold"
                    >
                        <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('italic') ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        title="Italic"
                    >
                        <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                        title="H1"
                    >
                        <Heading1 className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="H2"
                    >
                        <Heading2 className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('bulletList') ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        title="Bullet List"
                    >
                        <List className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('orderedList') ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        title="Ordered List"
                    >
                        <ListOrdered className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`h-8 w-8 p-0 ${editor?.isActive('blockquote') ? 'bg-accent' : ''}`}
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        title="Quote"
                    >
                        <Quote className="h-4 w-4" />
                    </Button>

                    <div className="w-[1px] h-4 bg-border mx-1" />

                    <Button type="button" variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <label className="cursor-pointer flex items-center justify-center">
                            <ImageIcon className="h-4 w-4" />
                            <input type="file" accept="image/*" className="hidden" onChange={addImage} />
                        </label>
                    </Button>

                    <div className="flex-grow" />

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => editor?.chain().focus().undo().run()}
                        title="Undo"
                    >
                        <Undo className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => editor?.chain().focus().redo().run()}
                        title="Redo"
                    >
                        <Redo className="h-4 w-4" />
                    </Button>
                </div>
                <EditorContent
                    editor={editor}
                    className="prose prose-sm dark:prose-invert max-w-none p-4 min-h-[150px] overflow-y-auto focus:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror_p]:my-1"
                />
            </div>
            <p className="text-[10px] text-muted-foreground italic">
                Tip: Changes are instantly previewed as you type. Images are stored in the description.
            </p>
        </div>
    );
}
