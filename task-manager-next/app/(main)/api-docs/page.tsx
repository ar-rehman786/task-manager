'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Terminal, Globe, Shield, Copy, Check, ChevronRight,
    BookOpen, ArrowRight, Code2, Zap, Lock, Search,
    ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
    Hash, ExternalLink, Eye, EyeOff
} from 'lucide-react';

const BASE_URL = 'https://task-manager-production-563b.up.railway.app';

// ─── Types ─────────────────────────────────────────────
interface QueryParam { name: string; type: string; required: boolean; description: string; example?: string; }
interface Endpoint {
    id: string; method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string; description: string; summary: string;
    queryParams?: QueryParam[];
    body?: { [key: string]: { type: string; required: boolean; description: string; example?: string } };
    responses: { [code: string]: { description: string; example?: any } };
    example: { curl: string; response: any };
}

// ─── Component Helpers ───────────────────────────────────
const methodColors: Record<string, string> = {
    GET: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
    POST: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    PATCH: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    DELETE: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
};

const statusColors: Record<string, string> = {
    '200': 'text-emerald-400',
    '201': 'text-emerald-400',
    '400': 'text-amber-400',
    '401': 'text-rose-400',
    '404': 'text-rose-400',
    '500': 'text-rose-400',
};

const groups = [
    { label: 'Projects', ids: ['get-projects', 'get-project', 'create-project', 'update-project', 'delete-project'] },
    { label: 'Tasks', ids: ['get-tasks', 'create-task', 'update-task', 'delete-task'] },
    { label: 'Team', ids: ['get-team'] },
];

function CodeBlock({ code, lang = 'bash', id, copyValue, onToggleVisibility, isRevealed }: {
    code: string;
    lang?: string;
    id: string;
    copyValue?: string;
    onToggleVisibility?: () => void;
    isRevealed?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(copyValue ?? code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative group rounded-xl overflow-hidden border border-white/5">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">{lang}</span>
                <div className="flex items-center gap-3">
                    {onToggleVisibility && (
                        <button onClick={onToggleVisibility} className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors">
                            {isRevealed ? <><EyeOff size={12} /><span>Hide</span></> : <><Eye size={12} /><span>Show</span></>}
                        </button>
                    )}
                    <button onClick={copy} className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-white transition-colors">
                        {copied ? <><Check size={12} className="text-emerald-400" /><span className="text-emerald-400">Copied!</span></> : <><Copy size={12} /><span>Copy</span></>}
                    </button>
                </div>
            </div>
            <pre className="p-4 text-sm font-mono text-zinc-300 overflow-x-auto bg-zinc-950 leading-relaxed">{code}</pre>
        </div>
    );
}

function EndpointCard({ ep, apiKey, maskKey, onToggleVisibility, isKeyRevealed }: {
    ep: Endpoint;
    apiKey: string;
    maskKey: (k: string) => string;
    onToggleVisibility: () => void;
    isKeyRevealed: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'example' | 'response' | 'params'>('example');

    return (
        <div id={ep.id} className={`rounded-2xl border overflow-hidden transition-all ${open ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-border/50 hover:border-border'}`}>
            {/* Header - always visible */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-accent/30 transition-colors"
            >
                <span className={`shrink-0 font-bold text-[11px] tracking-widest px-2.5 py-1 rounded-md border ${methodColors[ep.method]}`}>
                    {ep.method}
                </span>
                <code className="flex-1 text-sm font-mono text-foreground">{ep.path}</code>
                <span className="text-sm text-muted-foreground hidden md:block">{ep.summary}</span>
                <span className="shrink-0 text-muted-foreground">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            </button>

            {/* Expanded detail */}
            {open && (
                <div className="border-t border-border/50">
                    <div className="p-5 pb-0">
                        <p className="text-[14px] text-muted-foreground leading-relaxed">{ep.description}</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 px-5 pt-4 border-b border-border/50">
                        {(['example', 'response', 'params'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md capitalize transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {t === 'params' ? (ep.body ? 'Request Body' : ep.queryParams ? 'Query Params' : 'Params') : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="p-5 space-y-4">
                        {tab === 'example' && (
                            <div className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">cURL Request</p>
                                <CodeBlock
                                    code={apiKey ? ep.example.curl.replace(apiKey, maskKey(apiKey)) : ep.example.curl.replace(/\${apiKey}/g, maskKey(''))}
                                    copyValue={apiKey ? ep.example.curl : undefined}
                                    lang="bash"
                                    id={ep.id + '-curl'}
                                    onToggleVisibility={apiKey ? onToggleVisibility : undefined}
                                    isRevealed={isKeyRevealed}
                                />
                            </div>
                        )}

                        {tab === 'response' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    {Object.entries(ep.responses).map(([code, r]) => (
                                        <div key={code} className="flex gap-3 items-start p-3 rounded-lg bg-muted/30 border border-border/40">
                                            <span className={`shrink-0 font-mono font-bold text-sm ${statusColors[code] ?? 'text-zinc-400'}`}>{code}</span>
                                            <span className="text-sm text-muted-foreground">{r.description}</span>
                                        </div>
                                    ))}
                                </div>
                                {ep.example.response && (
                                    <>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Example Response</p>
                                        <CodeBlock code={JSON.stringify(ep.example.response, null, 2)} lang="json" id={ep.id + '-response'} />
                                    </>
                                )}
                            </div>
                        )}

                        {tab === 'params' && (
                            <div className="space-y-3">
                                {ep.queryParams && (
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Query Parameters</p>
                                        <div className="rounded-xl border border-border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    <tr>
                                                        <th className="text-left p-3">Parameter</th>
                                                        <th className="text-left p-3">Type</th>
                                                        <th className="text-left p-3">Required</th>
                                                        <th className="text-left p-3 hidden md:table-cell">Description</th>
                                                        <th className="text-left p-3 hidden lg:table-cell">Example</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                    {ep.queryParams.map(qp => (
                                                        <tr key={qp.name} className="hover:bg-muted/20">
                                                            <td className="p-3 font-mono text-primary font-semibold">{qp.name}</td>
                                                            <td className="p-3 text-muted-foreground">{qp.type}</td>
                                                            <td className="p-3">
                                                                {qp.required
                                                                    ? <span className="text-rose-400 text-[11px] font-bold">REQUIRED</span>
                                                                    : <span className="text-zinc-500 text-[11px]">optional</span>}
                                                            </td>
                                                            <td className="p-3 text-muted-foreground hidden md:table-cell">{qp.description}</td>
                                                            <td className="p-3 font-mono text-xs text-emerald-400 hidden lg:table-cell">{qp.example}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                                {ep.body && (
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Body Parameters (JSON)</p>
                                        <div className="rounded-xl border border-border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                    <tr>
                                                        <th className="text-left p-3">Field</th>
                                                        <th className="text-left p-3">Type</th>
                                                        <th className="text-left p-3">Required</th>
                                                        <th className="text-left p-3 hidden md:table-cell">Description</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                    {Object.entries(ep.body).map(([field, info]) => (
                                                        <tr key={field} className="hover:bg-muted/20">
                                                            <td className="p-3 font-mono text-primary font-semibold">{field}</td>
                                                            <td className="p-3 text-muted-foreground">{info.type}</td>
                                                            <td className="p-3">
                                                                {info.required
                                                                    ? <span className="text-rose-400 text-[11px] font-bold">REQUIRED</span>
                                                                    : <span className="text-zinc-500 text-[11px]">optional</span>}
                                                            </td>
                                                            <td className="p-3 text-muted-foreground hidden md:table-cell">{info.description}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="mt-3">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Example Body</p>
                                            <CodeBlock
                                                code={JSON.stringify(Object.fromEntries(Object.entries(ep.body).map(([k, v]) => [k, v.example ?? '...'])), null, 2)}
                                                lang="json"
                                                id={ep.id + '-body'}
                                            />
                                        </div>
                                    </div>
                                )}
                                {!ep.body && !ep.queryParams && (
                                    <p className="text-sm text-muted-foreground italic">This endpoint does not accept any parameters.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────
export default function ApiDocsPage() {
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isKeyRevealed, setIsKeyRevealed] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        axios.get('/api/admin/api-key', { withCredentials: true })
            .then(res => {
                if (res.data.apiKey) {
                    setApiKey(res.data.apiKey);
                } else {
                    console.error('API key missing in response');
                    setHasError(true);
                }
            })
            .catch(err => {
                console.error('Failed to fetch API key', err);
                setHasError(true);
            });
    }, []);

    const endpoints: Endpoint[] = [
        {
            id: 'get-projects',
            method: 'GET',
            path: '/api/projects',
            summary: 'List all projects',
            description: 'Returns a list of all projects in the workspace, ordered by creation date (newest first).',
            responses: {
                '200': {
                    description: 'An array of project objects.',
                    example: [{ id: 1, name: 'Website Redesign', description: 'Complete overhaul of company website', status: 'active', createdAt: '2025-03-01T10:00:00Z' }]
                },
                '401': { description: 'Invalid or missing API key.' }
            },
            example: {
                curl: `curl -X GET "${BASE_URL}/api/projects" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: [{ id: 1, name: 'Website Redesign', description: 'Complete overhaul of company website', status: 'active', createdAt: '2025-03-01T10:00:00Z' }, { id: 2, name: 'Mobile App', description: 'iOS & Android companion app', status: 'active', createdAt: '2025-02-15T09:00:00Z' }]
            }
        },
        {
            id: 'get-project',
            method: 'GET',
            path: '/api/projects/:id',
            summary: 'Get single project',
            description: 'Returns full details for a specific project identified by its ID.',
            responses: {
                '200': { description: 'A single project object.', example: { id: 1, name: 'Website Redesign', description: 'Complete overhaul of company website', status: 'active', createdAt: '2025-03-01T10:00:00Z' } },
                '401': { description: 'Invalid or missing API key.' },
                '404': { description: 'Project not found.' }
            },
            example: {
                curl: `curl -X GET "${BASE_URL}/api/projects/1" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: { id: 1, name: 'Website Redesign', description: 'Complete overhaul of company website', status: 'active', createdAt: '2025-03-01T10:00:00Z' }
            }
        },
        {
            id: 'create-project',
            method: 'POST',
            path: '/api/projects',
            summary: 'Create a project',
            description: 'Creates a new project in the workspace. The title field is required.',
            body: {
                name: { type: 'string', required: true, description: 'The name of the project.', example: 'Website Redesign' },
                title: { type: 'string', required: true, description: 'The name/title of the project.', example: 'Website Redesign' },
                description: { type: 'string', required: false, description: 'A detailed description of the project.', example: 'Complete overhaul of company website' }
            },
            responses: {
                '201': { description: 'The newly created project object.', example: { id: 3, name: 'Website Redesign', description: 'Complete overhaul', status: 'active', createdAt: '2025-03-13T01:00:00Z' } },
                '400': { description: 'Missing required fields (title).' },
                '401': { description: 'Invalid or missing API key.' }
            },
            example: {
                curl: `curl -X POST "${BASE_URL}/api/projects" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Website Redesign","title":"Website Redesign","description":"Complete overhaul"}'`,
                response: { id: 3, name: 'Website Redesign', description: 'Complete overhaul', status: 'active', createdAt: '2025-03-13T01:00:00Z' }
            }
        },
        {
            id: 'update-project',
            method: 'PATCH',
            path: '/api/projects/:id',
            summary: 'Update a project',
            description: 'Partially updates an existing project. Only send the fields you want to change.',
            body: {
                title: { type: 'string', required: false, description: 'New name for the project.', example: 'Website Redesign v2' },
                description: { type: 'string', required: false, description: 'Updated project description.', example: 'Phase 2 redesign' }
            },
            responses: {
                '200': { description: 'The updated project object.' },
                '400': { description: 'No valid fields provided.' },
                '401': { description: 'Invalid or missing API key.' },
                '404': { description: 'Project not found.' }
            },
            example: {
                curl: `curl -X PATCH "${BASE_URL}/api/projects/1" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Website Redesign v2"}'`,
                response: { id: 1, name: 'Website Redesign v2', description: 'Complete overhaul', status: 'active', updatedAt: '2025-03-13T01:30:00Z' }
            }
        },
        {
            id: 'delete-project',
            method: 'DELETE',
            path: '/api/projects/:id',
            summary: 'Delete a project',
            description: 'Permanently deletes a project and all associated data. This action is irreversible.',
            responses: {
                '200': { description: 'Success confirmation message.', example: { message: 'Project deleted successfully' } },
                '401': { description: 'Invalid or missing API key.' },
                '404': { description: 'Project not found.' }
            },
            example: {
                curl: `curl -X DELETE "${BASE_URL}/api/projects/1" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: { message: 'Project deleted successfully' }
            }
        },
        {
            id: 'get-tasks',
            method: 'GET',
            path: '/api/tasks',
            summary: 'List all tasks',
            description: 'Returns a list of tasks. Supports powerful filtering via query parameters.',
            queryParams: [
                { name: 'project', type: 'integer', required: false, description: 'Filter tasks by project ID.', example: '1' },
                { name: 'status', type: 'string', required: false, description: 'Filter by status. One of: todo, in_progress, blocked, done.', example: 'in_progress' },
                { name: 'assignee', type: 'integer', required: false, description: 'Filter tasks assigned to a specific user ID.', example: '3' }
            ],
            responses: {
                '200': { description: 'An array of task objects.' },
                '401': { description: 'Invalid or missing API key.' }
            },
            example: {
                curl: `curl -X GET "${BASE_URL}/api/tasks?project=1&status=in_progress" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: [{ id: 5, title: 'Design homepage', description: 'Create wireframes', status: 'in_progress', projectId: 1, assignedUserId: 2, createdAt: '2025-03-10T08:00:00Z' }]
            }
        },
        {
            id: 'create-task',
            method: 'POST',
            path: '/api/tasks',
            summary: 'Create a task',
            description: 'Creates a new task. Both title and projectId are required. If no status is provided, it defaults to "todo".',
            body: {
                title: { type: 'string', required: true, description: 'The task title.', example: 'Design homepage mockup' },
                description: { type: 'string', required: false, description: 'Detailed description of the task.', example: 'Create lo-fi and hi-fi wireframes' },
                projectId: { type: 'integer', required: true, description: 'ID of the project this task belongs to.', example: '1' },
                assignedUserId: { type: 'integer', required: false, description: 'User ID of the team member to assign this task to.', example: '3' },
                status: { type: 'string', required: false, description: 'Initial status. One of: todo, in_progress, blocked, done. Defaults to "todo".', example: 'todo' }
            },
            responses: {
                '201': { description: 'The newly created task object.' },
                '400': { description: 'Missing required fields (title or projectId).' },
                '401': { description: 'Invalid or missing API key.' }
            },
            example: {
                curl: `curl -X POST "${BASE_URL}/api/tasks" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Design homepage","projectId":1,"assignedUserId":2,"status":"todo"}'`,
                response: { id: 6, title: 'Design homepage', description: null, status: 'todo', projectId: 1, assignedUserId: 2, createdAt: '2025-03-13T02:00:00Z' }
            }
        },
        {
            id: 'update-task',
            method: 'PATCH',
            path: '/api/tasks/:id',
            summary: 'Update a task',
            description: 'Partially updates an existing task. Common use case: changing the status as a task progresses.',
            body: {
                title: { type: 'string', required: false, description: 'Updated task title.', example: 'Design homepage v2' },
                description: { type: 'string', required: false, description: 'Updated task description.' },
                status: { type: 'string', required: false, description: 'New status. One of: todo, in_progress, blocked, done.', example: 'done' }
            },
            responses: {
                '200': { description: 'The updated task object.' },
                '400': { description: 'No valid fields provided.' },
                '401': { description: 'Invalid or missing API key.' },
                '404': { description: 'Task not found.' }
            },
            example: {
                curl: `curl -X PATCH "${BASE_URL}/api/tasks/5" \\\n  -H "X-API-Key: ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"done"}'`,
                response: { id: 5, title: 'Design homepage', status: 'done', updatedAt: '2025-03-13T03:00:00Z' }
            }
        },
        {
            id: 'delete-task',
            method: 'DELETE',
            path: '/api/tasks/:id',
            summary: 'Delete a task',
            description: 'Permanently deletes a task. This cannot be undone.',
            responses: {
                '200': { description: 'Success confirmation message.', example: { message: 'Task deleted successfully' } },
                '401': { description: 'Invalid or missing API key.' },
                '404': { description: 'Project not found.' }
            },
            example: {
                curl: `curl -X DELETE "${BASE_URL}/api/tasks/5" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: { message: 'Task deleted successfully' }
            }
        },
        {
            id: 'get-team',
            method: 'GET',
            path: '/api/team-members',
            summary: 'List team members',
            description: 'Returns all active team members and their public profile information. Useful for populating assignee dropdowns.',
            responses: {
                '200': { description: 'An array of team member objects.', example: [{ id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', title: 'Engineering Lead', department: 'Engineering' }] },
                '401': { description: 'Invalid or missing API key.' }
            },
            example: {
                curl: `curl -X GET "${BASE_URL}/api/team-members" \\\n  -H "X-API-Key: ${apiKey}"`,
                response: [{ id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin', title: 'Engineering Lead', department: 'Engineering' }, { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'member', title: 'Designer', department: 'Design' }]
            }
        }
    ];

    const filtered = endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const maskKey = (key: string) => {
        if (!key) return hasError ? 'Error loading key' : 'Loading...';
        return isKeyRevealed ? key : '••••••••••••••••';
    };

    return (
        <div className="flex h-full min-h-screen">
            {/* Sidebar nav */}
            <aside className="hidden xl:flex flex-col w-56 shrink-0 border-r border-border sticky top-0 h-screen overflow-y-auto py-6 px-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-2">Navigation</p>
                <a href="#auth" className="text-sm text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-md hover:bg-accent flex items-center gap-2 transition-colors">
                    <Lock size={13} /> Authentication
                </a>
                <a href="#errors" className="text-sm text-muted-foreground hover:text-foreground py-1.5 px-2 rounded-md hover:bg-accent flex items-center gap-2 transition-colors">
                    <AlertCircle size={13} /> Error Codes
                </a>
                <div className="mt-4">
                    {groups.map(g => (
                        <div key={g.label} className="mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-2">{g.label}</p>
                            {endpoints.filter(e => g.ids.includes(e.id)).map(ep => (
                                <a key={ep.id} href={`#${ep.id}`}
                                    className="flex items-center gap-2 text-[12px] py-1 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                    <span className={`text-[9px] font-black shrink-0 ${ep.method === 'GET' ? 'text-sky-400' : ep.method === 'POST' ? 'text-emerald-400' : ep.method === 'PATCH' ? 'text-amber-400' : 'text-rose-400'}`}>{ep.method}</span>
                                    <span className="truncate font-mono">{ep.path.replace('/api/', '').split('/')[0]}</span>
                                </a>
                            ))}
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 max-w-4xl mx-auto py-10 px-6 space-y-10">
                {/* Hero */}
                <div>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-4">
                        <Zap size={12} /> REST API — v1
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent mb-3">
                        API Reference
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        Complete reference documentation for the Project Management API. Build integrations, automate workflows, and manage your workspace programmatically.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-5">
                        <div className="flex items-center gap-2 text-sm font-mono bg-muted/40 border border-border rounded-lg px-3 py-2">
                            <Globe size={14} className="text-muted-foreground" />
                            <span className="text-muted-foreground">Base URL:</span>
                            <span className="text-primary">{BASE_URL}</span>
                        </div>
                        <a href={BASE_URL} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ExternalLink size={13} /> Open in browser
                        </a>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search endpoints…"
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                    />
                </div>

                {/* Auth section */}
                <section id="auth" className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
                    <div className="flex items-center gap-3 p-6 border-b border-primary/10">
                        <div className="p-2 rounded-lg bg-primary/15 text-primary"><Shield size={20} /></div>
                        <div>
                            <h2 className="font-bold text-lg">Authentication</h2>
                            <p className="text-sm text-muted-foreground">All requests require an API key</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every request to the API must include an <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">X-API-Key</code> header.
                            Requests without a valid key will receive a <code className="text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">401 Unauthorized</code> response.
                        </p>
                        <CodeBlock
                            id="auth-header"
                            lang="http"
                            code={`X-API-Key: ${maskKey(apiKey)}`}
                            copyValue={`X-API-Key: ${apiKey || 'N/A'}`}
                            onToggleVisibility={apiKey ? () => setIsKeyRevealed(!isKeyRevealed) : undefined}
                            isRevealed={isKeyRevealed}
                        />
                        {hasError && (
                            <p className="text-xs text-rose-400 mt-2">
                                <AlertCircle size={10} className="inline mr-1" />
                                Failed to fetch API key. Make sure you are logged in as an administrator.
                            </p>
                        )}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex gap-3">
                                <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-emerald-400">Valid key</p>
                                    <p className="text-xs text-muted-foreground mt-1">Request proceeds normally and returns data.</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex gap-3">
                                <AlertCircle size={18} className="text-rose-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-rose-400">Invalid / missing key</p>
                                    <p className="text-xs text-muted-foreground mt-1">Returns {"{ \"error\": \"Unauthorized\" }"} with HTTP 401.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Error codes section */}
                <section id="errors">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <AlertCircle size={20} className="text-muted-foreground" /> Error Codes
                    </h2>
                    <div className="rounded-2xl border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <tr>
                                    <th className="text-left p-4">Status</th>
                                    <th className="text-left p-4">Meaning</th>
                                    <th className="text-left p-4 hidden md:table-cell">When it occurs</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {[
                                    { code: '200', color: 'text-emerald-400', label: 'OK', desc: 'Request succeeded.' },
                                    { code: '201', color: 'text-emerald-400', label: 'Created', desc: 'Resource was successfully created.' },
                                    { code: '400', color: 'text-amber-400', label: 'Bad Request', desc: 'Missing or invalid request body fields.' },
                                    { code: '401', color: 'text-rose-400', label: 'Unauthorized', desc: 'API key is missing or incorrect.' },
                                    { code: '404', color: 'text-rose-400', label: 'Not Found', desc: 'The requested resource doesn\'t exist.' },
                                    { code: '500', color: 'text-rose-400', label: 'Server Error', desc: 'An unexpected server error occurred.' },
                                ].map(r => (
                                    <tr key={r.code} className="hover:bg-muted/20 transition-colors">
                                        <td className={`p-4 font-mono font-bold ${r.color}`}>{r.code}</td>
                                        <td className="p-4 font-medium">{r.label}</td>
                                        <td className="p-4 text-muted-foreground hidden md:table-cell">{r.desc}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Endpoints */}
                <section>
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <Code2 size={20} className="text-muted-foreground" /> Endpoints
                    </h2>

                    {searchQuery ? (
                        <div className="space-y-3">
                            {filtered.length === 0
                                ? <p className="text-muted-foreground text-sm text-center py-8">No endpoints match your search.</p>
                                : filtered.map(ep => (
                                    <EndpointCard
                                        key={ep.id}
                                        ep={ep}
                                        apiKey={apiKey}
                                        maskKey={maskKey}
                                        onToggleVisibility={() => setIsKeyRevealed(!isKeyRevealed)}
                                        isKeyRevealed={isKeyRevealed}
                                    />
                                ))
                            }
                        </div>
                    ) : (
                        groups.map(group => (
                            <div key={group.label} className="mb-8">
                                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                    <Hash size={12} /> {group.label}
                                </h3>
                                <div className="space-y-3">
                                    {endpoints.filter(ep => group.ids.includes(ep.id)).map(ep => (
                                        <EndpointCard
                                            key={ep.id}
                                            ep={ep}
                                            apiKey={apiKey}
                                            maskKey={maskKey}
                                            onToggleVisibility={() => setIsKeyRevealed(!isKeyRevealed)}
                                            isKeyRevealed={isKeyRevealed}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </section>

                {/* Quick Start */}
                <section className="bg-gradient-to-br from-zinc-900 to-zinc-950 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-lg"><Terminal size={18} className="text-primary-foreground" /></div>
                        <div>
                            <h2 className="font-bold text-white">Quick Start</h2>
                            <p className="text-sm text-zinc-400">Up and running in three steps</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {[
                            { step: '1', title: 'Get your API key', code: `# Your API key:\nX-API-Key: your-secret` },
                            { step: '2', title: 'Fetch your projects', code: `curl -X GET "${BASE_URL}/api/projects" \\\n  -H "X-API-Key: your-secret"` },
                            { step: '3', title: 'Create a task', code: `curl -X POST "${BASE_URL}/api/tasks" \\\n  -H "X-API-Key: your-secret" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"My first task","projectId":1}'` },
                        ].map(item => (
                            <div key={item.step} className="flex gap-4">
                                <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center border border-primary/30">
                                    {item.step}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <p className="text-sm font-semibold text-white">{item.title}</p>
                                    <CodeBlock
                                        code={apiKey ? item.code.replace(/your-secret/g, maskKey(apiKey)) : item.code.replace(/your-secret/g, maskKey(''))}
                                        copyValue={apiKey ? item.code.replace(/your-secret/g, apiKey) : undefined}
                                        lang="bash"
                                        id={`qs-${item.step}`}
                                        onToggleVisibility={apiKey ? () => setIsKeyRevealed(!isKeyRevealed) : undefined}
                                        isRevealed={isKeyRevealed}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <footer className="text-center text-xs text-muted-foreground pt-4 pb-10">
                    Project Management API · All requests must include <code className="bg-muted px-1 rounded">X-API-Key: {maskKey(apiKey)}</code>
                </footer>
            </main>
        </div>
    );
}
