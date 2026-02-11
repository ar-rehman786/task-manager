'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    Connection,
    Edge,
    Node,
    applyEdgeChanges,
    applyNodeChanges,
    NodeChange,
    EdgeChange,
    Panel,
    Handle,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Save, ChevronLeft, Download, Plus, Workflow, Zap, Database, Globe, Mail } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ideationApi } from '@/lib/api/ideation';
import Link from 'next/link';

// Custom Node Component
const WorkflowNode = ({ data, selected }: any) => {
    const Icon = data.icon || Workflow;
    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-card border-2 transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
            <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-primary" />
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded bg-primary/10 text-primary`}>
                    <Icon size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold">{data.label}</span>
                    {data.description && <span className="text-[10px] text-muted-foreground">{data.description}</span>}
                </div>
            </div>
            <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-primary" />
        </div>
    );
};

const nodeTypes = {
    workflow: WorkflowNode,
};

// Templates
const n8nTemplates = {
    webhook: {
        label: 'Webhook Trigger',
        description: 'Listen for HTTP requests',
        icon: Globe,
        type: 'workflow',
    },
    cron: {
        label: 'Schedule Trigger',
        description: 'Run on a schedule',
        icon: Zap,
        type: 'workflow',
    },
    db: {
        label: 'PostgreSQL',
        description: 'Read/Write from DB',
        icon: Database,
        type: 'workflow',
    },
    email: {
        label: 'Gmail',
        description: 'Send/Read emails',
        icon: Mail,
        type: 'workflow',
    }
};

interface MindMapProps {
    id: number;
    initialData: any;
    name: string;
}

export function MindMap({ id, initialData, name }: MindMapProps) {
    const queryClient = useQueryClient();
    const [nodes, setNodes] = useState<Node[]>(initialData?.nodes || []);
    const [edges, setEdges] = useState<Edge[]>(initialData?.edges || []);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes]
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const updateMutation = useMutation({
        mutationFn: (data: any) => ideationApi.updateBoard(id, { data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_board', id] });
        },
    });

    const handleSave = () => {
        updateMutation.mutate({ nodes, edges });
    };

    const addNode = (templateKey: keyof typeof n8nTemplates) => {
        const template = n8nTemplates[templateKey];
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: 'workflow',
            position: { x: Math.random() * 400, y: Math.random() * 400 },
            data: { ...template },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="h-[calc(100vh-12rem)] w-full relative border rounded-xl overflow-hidden shadow-inner bg-accent/5">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background color="#aaa" gap={20} />
                <Controls />
                <MiniMap />

                <Panel position="top-left" className="bg-card/90 backdrop-blur p-4 rounded-lg border shadow-lg flex flex-col gap-4 max-w-xs">
                    <div>
                        <h2 className="font-bold text-lg mb-1">{name}</h2>
                        <p className="text-xs text-muted-foreground underline decoration-dotted">n8n Workflow Visualizer</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(n8nTemplates).map(([key, template]) => (
                            <Button
                                key={key}
                                variant="outline"
                                size="sm"
                                className="justify-start text-xs h-auto py-2 px-3 flex-col items-start gap-1 hover:border-primary transition-colors"
                                onClick={() => addNode(key as any)}
                            >
                                <template.icon size={14} className="text-primary" />
                                <span>{template.label}</span>
                            </Button>
                        ))}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" className="flex-1" onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save size={14} className="mr-2" /> {updateMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="secondary">
                            <Download size={14} />
                        </Button>
                    </div>
                </Panel>

                <Panel position="top-right">
                    <Link href="/ideation">
                        <Button variant="ghost" size="sm" className="bg-card/90 backdrop-blur border shadow-sm">
                            <ChevronLeft size={16} className="mr-1" /> Back to Boards
                        </Button>
                    </Link>
                </Panel>
            </ReactFlow>
        </div>
    );
}
