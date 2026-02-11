'use client';

import React, { useCallback, useState, useEffect } from 'react';
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
import {
    Save,
    ChevronLeft,
    Download,
    Plus,
    Workflow,
    Zap,
    Database,
    Globe,
    Mail,
    Cpu,
    Layers,
    Lock,
    Share2,
    Slack,
    Github,
    Box,
    Trash2,
    Edit3,
    Check,
    Cloud,
    Code,
    CreditCard,
    FileText,
    HardDrive,
    Layout,
    Link as LinkIcon,
    Moon,
    Music,
    Phone,
    Play,
    RefreshCw,
    Search,
    Send,
    Shield,
    Smartphone,
    Smile,
    Star,
    Sun,
    Tag,
    Terminal,
    User,
    Users,
    Video,
    Volume2,
    Wrench
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ideationApi } from '@/lib/api/ideation';
import Link from 'next/link';

// Custom Node Component
const WorkflowNode = ({ data, selected, id }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label);
    const [description, setDescription] = useState(data.description);
    const Icon = data.icon || Workflow;

    useEffect(() => {
        setLabel(data.label);
        setDescription(data.description);
    }, [data.label, data.description]);

    const handleSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onChange(id, { label, description });
        setIsEditing(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        data.onDelete(id);
    };

    return (
        <div
            className={`px-4 py-3 shadow-lg rounded-xl bg-card border-2 transition-all min-w-[200px] ${selected ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-border'}`}
            onDoubleClick={() => setIsEditing(true)}
        >
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-primary border-2 border-background" />

            <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg bg-primary/10 text-primary shrink-0`}>
                    <Icon size={22} />
                </div>

                <div className="flex-1 min-w-0 pr-6">
                    {isEditing ? (
                        <div className="space-y-2 py-1" onClick={(e) => e.stopPropagation()}>
                            <input
                                autoFocus
                                className="w-full text-sm font-bold bg-transparent border-b border-primary focus:outline-none"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                            />
                            <textarea
                                className="w-full text-[10px] text-muted-foreground bg-transparent border-b border-border focus:outline-none resize-none"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={1}
                            />
                            <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={handleSave}>
                                    <Check size={14} />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-1">
                            <h3 className="text-sm font-bold truncate">{label}</h3>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                                {description || 'Double click to edit'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {selected && !isEditing && (
                <div className="absolute -top-3 -right-3 flex gap-1 z-50">
                    <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 rounded-full shadow-md border"
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                    >
                        <Edit3 size={12} />
                    </Button>
                    <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7 rounded-full shadow-md"
                        onClick={handleDelete}
                    >
                        <Trash2 size={12} />
                    </Button>
                </div>
            )}

            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-primary border-2 border-background" />
        </div>
    );
};

const nodeTypes = {
    workflow: WorkflowNode,
};

// Expanded Templates Categories
const categories = [
    {
        name: 'Logic & Triggers',
        items: {
            webhook: { label: 'Webhook Trigger', description: 'Listen for HTTP requests', icon: Globe },
            cron: { label: 'Schedule Trigger', description: 'Run on a schedule', icon: Zap },
            logic: { label: 'Condition', description: 'If/Else decision logic', icon: Share2 },
            custom: { label: 'Custom Idea', description: 'Start a new thought', icon: Plus },
        }
    },
    {
        name: 'Services',
        items: {
            db: { label: 'Database', description: 'Query or store data', icon: Database },
            email: { label: 'Email', description: 'Send notifications', icon: Mail },
            slack: { label: 'Slack', description: 'Post to a channel', icon: Slack },
            storage: { label: 'Storage', description: 'Cloud file management', icon: Box },
        }
    },
    {
        name: 'Technical',
        items: {
            api: { label: 'API Call', description: 'External request', icon: Globe },
            code: { label: 'Code Block', description: 'Run custom JS/Python', icon: Code },
            auth: { label: 'Security', description: 'Authentication flow', icon: Shield },
            cpu: { label: 'Processing', description: 'Heavy data compute', icon: Cpu },
        }
    }
];

interface MindMapProps {
    id: number;
    initialData: any;
    name: string;
}

export function MindMap({ id, initialData, name }: MindMapProps) {
    const queryClient = useQueryClient();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    useEffect(() => {
        if (initialData?.nodes) {
            setNodes(initialData.nodes.map((n: any) => ({
                ...n,
                data: {
                    ...n.data,
                    onChange: (nodeId: string, newData: any) => {
                        setNodes((nds) => nds.map((node) => {
                            if (node.id === nodeId) return { ...node, data: { ...node.data, ...newData } };
                            return node;
                        }));
                    },
                    onDelete: (nodeId: string) => {
                        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
                        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
                    }
                }
            })));
        } else {
            setNodes([]);
        }
        if (initialData?.edges) {
            setEdges(initialData.edges);
        } else {
            setEdges([]);
        }
    }, [initialData?.nodes, initialData?.edges]);

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes]
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );
    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    );

    const updateMutation = useMutation({
        mutationFn: (data: any) => ideationApi.updateBoard(id, { data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ideation_board', id] });
        },
    });

    const handleSave = () => {
        // Simple sanitization for functions
        const cleanNodes = nodes.map(({ data, ...n }) => {
            const { onChange, onDelete, ...restData } = data;
            return { ...n, data: restData };
        });
        updateMutation.mutate({ nodes: cleanNodes, edges });
    };

    const addNode = (template: any) => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type: 'workflow',
            position: { x: 500, y: 200 },
            data: {
                ...template,
                onChange: (nodeId: string, newData: any) => {
                    setNodes((nds) => nds.map((node) => {
                        if (node.id === nodeId) return { ...node, data: { ...node.data, ...newData } };
                        return node;
                    }));
                },
                onDelete: (nodeId: string) => {
                    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
                    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
                }
            },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <div className="h-[calc(100vh-10rem)] w-full relative border rounded-2xl overflow-hidden shadow-2xl bg-slate-50">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                snapToGrid
                snapGrid={[15, 15]}
            >
                <Background color="#cbd5e1" gap={20} variant="dots" />
                <Controls />
                <MiniMap className="!bg-background/80 !backdrop-blur" />

                <Panel position="top-right" className="bg-card/95 backdrop-blur-md p-6 rounded-2xl border shadow-2xl flex flex-col gap-6 max-w-[340px] max-h-[85%] overflow-auto">
                    <div>
                        <h2 className="font-black text-2xl mb-1 text-primary tracking-tight">{name}</h2>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-black tracking-widest bg-primary/5 p-1 rounded w-fit">
                            <Workflow size={12} className="text-primary" /> Visual Designer
                        </div>
                    </div>

                    <div className="space-y-6">
                        {categories.map((cat) => (
                            <div key={cat.name} className="space-y-3">
                                <h3 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest pl-1">{cat.name}</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(cat.items).map(([key, template]) => (
                                        <Button
                                            key={key}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start text-xs h-auto py-3 px-3 flex-col items-start gap-1.5 hover:border-primary hover:bg-primary/5 transition-all group border-slate-200 bg-white"
                                            onClick={() => addNode(template)}
                                        >
                                            <template.icon size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                                            <span className="font-bold">{template.label}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2 pt-4 border-t mt-2">
                        <Button size="sm" className="flex-1 font-bold shadow-lg" onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save size={14} className="mr-2" /> {updateMutation.isPending ? 'Syncing...' : 'Save Mind Map'}
                        </Button>
                        <Button size="sm" variant="outline" className="px-3" title="Download Image">
                            <Download size={14} />
                        </Button>
                    </div>
                </Panel>

                <Panel position="top-left">
                    <Link href="/ideation">
                        <Button variant="outline" size="sm" className="bg-card/90 backdrop-blur shadow-sm font-bold border-2 hover:bg-accent transition-colors">
                            <ChevronLeft size={16} className="mr-1" /> Board Gallery
                        </Button>
                    </Link>
                </Panel>
            </ReactFlow>
        </div>
    );
}
