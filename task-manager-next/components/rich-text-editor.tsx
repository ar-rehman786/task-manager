'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
    Bold, Italic, List, ListOrdered,
    Heading1, Heading2, Image as ImageIcon,
    Undo, Redo, Quote, AlertTriangle, FileText, Settings2
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
}

const SAFE_LIMIT = 200000; // 200k characters safety threshold

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const [isLargeContent, setIsLargeContent] = useState(content.length > SAFE_LIMIT);
    const [showWarning, setShowWarning] = useState(content.length > SAFE_LIMIT);
    const [editMode, setEditMode] = useState<'rich' | 'plain'>(content.length > SAFE_LIMIT ? 'plain' : 'rich');

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: true,
                allowBase64: true,
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            if (editMode === 'rich') {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[150px] p-4 border rounded-md',
            },
        },
    }, [editMode === 'rich' && !showWarning]); // Only initialize if we're in rich mode and warning is cleared

    // Keep editor content in sync only if not in plain mode
    useEffect(() => {
        if (editor && content !== editor.getHTML() && editMode === 'rich') {
            editor.commands.setContent(content);
        }
    }, [content, editor, editMode]);

    const addImage = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !editor) return;

        // Convert image to base64 data URI to avoid ephemeral file storage issues
        const reader = new FileReader();
        reader.onload = () => {
            const base64Url = reader.result as string;
            if (base64Url) {
                editor.chain().focus().setImage({ src: base64Url }).run();
            }
        };
        reader.readAsDataURL(file);

        // Reset the input so the same file can be selected again
        event.target.value = '';
    };

    if (showWarning) {
        return (
            <div className="p-6 border-2 border-dashed border-yellow-500/50 rounded-lg bg-yellow-500/5 space-y-4">
                <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-500">
                    <AlertTriangle className="w-6 h-6" />
                    <h3 className="font-semibold text-lg">Large Content Detected</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    This description is very large ({Math.round(content.length / 1024)} KB) and might contain many large images.
                    Loading the rich text editor automatically may cause your browser to become unresponsive.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                            setEditMode('plain');
                            setShowWarning(false);
                        }}
                    >
                        <FileText className="w-4 h-4" />
                        Edit as Plain Text (Safe)
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 hover:bg-yellow-500/10"
                        onClick={() => {
                            setEditMode('rich');
                            setShowWarning(false);
                        }}
                    >
                        <Settings2 className="w-4 h-4" />
                        Load Rich Editor Anyway
                    </Button>
                </div>
            </div>
        );
    }

    if (editMode === 'plain') {
        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Plain Text Editor (HTML Mode)</span>
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-[10px]"
                        onClick={() => setEditMode('rich')}
                    >
                        Switch to Rich Editor
                    </Button>
                </div>
                <Textarea
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="min-h-[300px] font-mono text-xs p-4 bg-muted/20"
                />
                <p className="text-[10px] text-muted-foreground italic">
                    Note: In plain text mode, you are editing the raw HTML.
                </p>
            </div>
        );
    }

    if (!editor) {
        return (
            <div className="min-h-[150px] flex items-center justify-center border rounded-md bg-muted/10">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-t-md border border-b-0 items-center">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-accent' : ''}
                >
                    <Bold className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-accent' : ''}
                >
                    <Italic className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}
                >
                    <Heading1 className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
                >
                    <Heading2 className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'bg-accent' : ''}
                >
                    <List className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'bg-accent' : ''}
                >
                    <ListOrdered className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={editor.isActive('blockquote') ? 'bg-accent' : ''}
                >
                    <Quote className="w-4 h-4" />
                </Button>

                <div className="w-[1px] h-6 bg-border mx-1 my-auto" />

                <div className="relative">
                    <Button variant="ghost" size="sm" asChild>
                        <label className="cursor-pointer">
                            <ImageIcon className="w-4 h-4" />
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={addImage}
                            />
                        </label>
                    </Button>
                </div>

                <div className="flex-grow" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setEditMode('plain');
                    }}
                    title="Switch to Plain Text"
                >
                    <FileText className="w-4 h-4" />
                </Button>

                <div className="w-[1px] h-6 bg-border mx-1 my-auto" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().undo().run()}
                >
                    <Undo className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().redo().run()}
                >
                    <Redo className="w-4 h-4" />
                </Button>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
