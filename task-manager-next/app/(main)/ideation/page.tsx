'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Lightbulb, StickyNote, Trash2, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ideationApi } from '@/lib/api/ideation';
import { IdeationBoard } from '@/lib/types';
import ProtectedRoute from '@/components/protected-route';
import { IdeationDialog } from '@/components/ideation/ideation-dialog';
import Link from 'next/link';

export default function IdeationPage() {
    return (
        <ProtectedRoute>
            <IdeationContent />
        </ProtectedRoute>
    );
}

function IdeationContent() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedBoard, setSelectedBoard] = useState<IdeationBoard | null>(null);
    const queryClient = useQueryClient();

    const { data: boards, isLoading } = useQuery({
        queryKey: ['ideation_boards'],
        queryFn: ideationApi.getBoards,
    });

    const deleteBoardMutation = useMutation({
        mutationFn: ideationApi.deleteBoard,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_boards'] });
        },
    });

    const filteredBoards = boards?.filter(board =>
        board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        board.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Ideation Visualizer</h1>
                    <p className="text-muted-foreground group-hover:text-primary transition-colors">
                        Map out your n8n workflows, brainstorm ideas, and visualize logic.
                    </p>
                </div>
                <Button onClick={() => { setSelectedBoard(null); setIsDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Ideation Board
                </Button>
            </div>

            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <Input
                        placeholder="Search ideas, projects, or workflows..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="h-48 animate-pulse bg-muted" />
                    ))}
                </div>
            ) : filteredBoards?.length === 0 ? (
                <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4 border-dashed border-2">
                    <div className="p-4 bg-primary/10 rounded-full text-primary">
                        <Lightbulb size={48} />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">No ideation boards found</h3>
                        <p className="text-muted-foreground">Start by creating your first mind map or sticky note canvas.</p>
                    </div>
                    <Button onClick={() => setIsDialogOpen(true)}>Create Board</Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredBoards?.map((board) => (
                        <Card key={board.id} className="group overflow-hidden hover:shadow-lg transition-shadow border-2 hover:border-primary/50">
                            <div className="p-4 border-b bg-muted/30 flex justify-between items-start">
                                <div className={`p-2 rounded-lg ${board.type === 'mindmap' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                    {board.type === 'mindmap' ? <Lightbulb size={20} /> : <StickyNote size={20} />}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this board?')) {
                                                deleteBoardMutation.mutate(board.id);
                                            }
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </div>
                            <div className="p-4 space-y-2">
                                <h3 className="font-bold text-lg truncate">{board.name}</h3>
                                {board.projectName && (
                                    <p className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded inline-block">
                                        {board.projectName}
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground pt-2">
                                    Updated {new Date(board.updatedAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="p-4 bg-muted/10 border-t group-hover:bg-primary/5 transition-colors">
                                <Link href={`/ideation/${board.id}`}>
                                    <Button className="w-full" variant="outline">
                                        Open Board <ExternalLink className="ml-2 h-4 w-4" />
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <IdeationDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                board={selectedBoard}
            />
        </div>
    );
}
