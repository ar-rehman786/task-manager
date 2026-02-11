'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ideationApi } from '@/lib/api/ideation';
import { MindMap } from '@/components/ideation/mind-map';
import { StickyNotes } from '@/components/ideation/sticky-notes';
import ProtectedRoute from '@/components/protected-route';
import { Loader2 } from 'lucide-react';

export default function IdeationBoardPage() {
    const params = useParams();
    const id = parseInt(params.id as string);

    const { data: board, isLoading, error } = useQuery({
        queryKey: ['ideation_board', id],
        queryFn: () => ideationApi.getBoard(id),
    });

    if (isLoading) {
        return (
            <div className="h-[70vh] flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !board) {
        return (
            <div className="p-12 text-center text-destructive">
                <h2 className="text-2xl font-bold">Error loading board</h2>
                <p>The board might not exist or you don't have permission to view it.</p>
            </div>
        );
    }

    return (
        <ProtectedRoute>
            <div className="p-6 h-full">
                {board.type === 'mindmap' ? (
                    <MindMap id={board.id} initialData={board.data} name={board.name} />
                ) : (
                    <StickyNotes id={board.id} initialData={board.data} name={board.name} />
                )}
            </div>
        </ProtectedRoute>
    );
}
