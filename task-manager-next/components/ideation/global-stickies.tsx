'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStickyStore, FloatingSticky } from '@/lib/store/stickyStore';
import { Button } from '@/components/ui/button';
import { X, ExternalLink, GripHorizontal, Plus } from 'lucide-react';

export function GlobalStickies() {
    const { stickies, addSticky, removeSticky, updateSticky } = useStickyStore();
    const [isPiPSupported, setIsPiPSupported] = useState(false);

    useEffect(() => {
        setIsPiPSupported('documentPictureInPicture' in window);
    }, []);

    const handlePopOut = async (sticky: FloatingSticky) => {
        if (!isPiPSupported) {
            alert('Your browser does not support popping out windows (Try Chrome or Edge).');
            return;
        }

        try {
            // @ts-ignore - Experimental API
            const pipWindow = await window.documentPictureInPicture.requestWindow({
                width: sticky.width,
                height: sticky.height,
            });

            // Copy styles
            const styleSheets = Array.from(document.styleSheets);
            styleSheets.forEach((styleSheet) => {
                try {
                    const cssRules = Array.from(styleSheet.cssRules)
                        .map((rule) => rule.cssText)
                        .join('');
                    const style = document.createElement('style');
                    style.textContent = cssRules;
                    pipWindow.document.head.appendChild(style);
                } catch (e) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = (styleSheet as any).href;
                    pipWindow.document.head.appendChild(link);
                }
            });

            // Set background color of the new window
            pipWindow.document.body.style.backgroundColor = sticky.color;
            pipWindow.document.body.style.margin = '0';
            pipWindow.document.body.style.overflow = 'hidden';

            // Create a root for the PiP window
            const container = pipWindow.document.createElement('div');
            container.className = 'p-4 h-full flex flex-col font-sans';
            pipWindow.document.body.appendChild(container);

            // Render content (we use an iframe or just manual DOM for simplicity in this draft)
            // But since we want reactivity, it's better to use a portal. 
            // For now, let's do a standalone text area in the PiP.
            const header = pipWindow.document.createElement('div');
            header.className = 'flex justify-between items-center mb-2 font-bold text-sm border-b pb-1 opacity-50';
            header.innerHTML = `<span>Floating Note</span>`;
            container.appendChild(header);

            const textarea = pipWindow.document.createElement('textarea');
            textarea.className = 'flex-1 w-full bg-transparent border-none resize-none focus:outline-none text-sm font-medium';
            textarea.value = sticky.text;
            textarea.placeholder = 'Type something...';
            textarea.oninput = (e: any) => {
                updateSticky(sticky.id, { text: e.target.value });
            };
            container.appendChild(textarea);

            // Sync back if changed in main app
            const syncInterval = setInterval(() => {
                const current = useStickyStore.getState().stickies.find(s => s.id === sticky.id);
                if (current && textarea.value !== current.text) {
                    textarea.value = current.text;
                }
                if (!current) pipWindow.close();
            }, 500);

            pipWindow.onpagehide = () => clearInterval(syncInterval);

        } catch (err) {
            console.error('Failed to open PiP window:', err);
        }
    };

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999]">
            <AnimatePresence>
                {stickies.map((sticky) => (
                    <motion.div
                        key={sticky.id}
                        drag
                        dragMomentum={false}
                        initial={{ opacity: 0, scale: 0.8, x: sticky.x, y: sticky.y }}
                        animate={{ opacity: 1, scale: 1, x: sticky.x, y: sticky.y }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onDragEnd={(_, info) => {
                            updateSticky(sticky.id, {
                                x: sticky.x + info.offset.x,
                                y: sticky.y + info.offset.y
                            });
                        }}
                        style={{ backgroundColor: sticky.color }}
                        className="absolute pointer-events-auto w-64 h-64 p-4 shadow-2xl rounded-xl border border-black/5 flex flex-col group cursor-default"
                    >
                        <div className="flex justify-between items-center mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="cursor-grab active:cursor-grabbing p-1">
                                <GripHorizontal size={14} className="text-black/30" />
                            </div>
                            <div className="flex gap-1">
                                {isPiPSupported && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 rounded-full hover:bg-black/5"
                                        onClick={() => handlePopOut(sticky)}
                                        title="Stay on Desktop (External Window)"
                                    >
                                        <ExternalLink size={12} className="text-black/50" />
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 rounded-full hover:bg-black/5 text-destructive"
                                    onClick={() => removeSticky(sticky.id)}
                                >
                                    <X size={12} />
                                </Button>
                            </div>
                        </div>
                        <textarea
                            className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-sm font-medium leading-relaxed placeholder:text-black/20 text-black/80"
                            placeholder="Pinned thought..."
                            value={sticky.text}
                            onChange={(e) => updateSticky(sticky.id, { text: e.target.value })}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Quick Fab to add sticky - ONLY show if list empty or as a main utility */}
            {stickies.length === 0 && (
                <div className="absolute bottom-8 right-8 pointer-events-auto">
                    <Button
                        size="icon"
                        className="h-14 w-14 rounded-full shadow-xl animate-bounce"
                        onClick={addSticky}
                        title="New Floating Sticky"
                    >
                        <Plus size={24} />
                    </Button>
                </div>
            )}
        </div>
    );
}
