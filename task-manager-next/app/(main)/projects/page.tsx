'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import api from '@/lib/api/client';
import { Project, Milestone, AccessItem, ProjectLog, Transcription, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { ProjectDialog } from '@/components/projects/project-dialog';
import { MilestoneDialog } from '@/components/projects/milestone-dialog';
import { AccessRequestDialog } from '@/components/projects/access-request-dialog';
import { TranscriptionDialog } from '@/components/projects/transcription-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from "@/components/ui/textarea"
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Terminal, Globe, Shield, Copy, Check, ChevronRight,
    BookOpen, ArrowRight, Code2, Zap, Lock, Search,
    ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
    Hash, ExternalLink, Eye, EyeOff, FileText, Image as ImageIcon,
    Plus, ArrowUpDown, FolderKanban, Building, Calendar, Edit3, FileJson, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import React from 'react';

const safeFormatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'No Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
    active:                      { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
    on_hold:                     { label: 'On Hold',   dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
    paused:                      { label: 'On Hold',   dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' },
    completed:                   { label: 'Completed', dot: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' },
    waiting_for_client_response: { label: 'Waiting',   dot: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20' },
    closed:                      { label: 'Closed',    dot: 'bg-slate-400',   text: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20' },
};

const getStatusConfig = (status?: string) =>
    STATUS_CONFIG[status || ''] ?? { label: status ?? 'Unknown', dot: 'bg-primary', text: 'text-primary', bg: 'bg-primary/5 border-primary/20' };

function Avatar({ name, colorClass = 'bg-violet-500' }: { name: string; colorClass?: string }) {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return (
        <div className={`w-5 h-5 ${colorClass} rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
            {initials}
        </div>
    );
}

export default function ProjectsPage() {
    return (
        <ProtectedRoute>
            <ProjectsContent />
        </ProtectedRoute>
    );
}

function ProjectsContent() {
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('name');

    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getProjects,
    });

    const createMutation = useMutation({
        mutationFn: projectsApi.createProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Project> }) =>
            projectsApi.updateProject(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            if (selectedProject) {
                // Refresh selected project details if currently viewing one
                // We might need to refetch specific project or just trust invalidation
                // For simplicity, we can close detail view or update local state if we had it
                // Re-fetching list handles the list view.
                setSelectedProject(null); // Go back to list to see changes
            }
        },
    });

    const archiveMutation = useMutation({
        mutationFn: projectsApi.deleteProject, // This is now an archive operation on the backend
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            setSelectedProject(null);
            toast.success('Project archived successfully');
        },
    });

    const handleCreateProject = () => {
        setEditingProject(null);
        setIsDialogOpen(true);
    };

    const handleEditProject = (project: Project) => {
        setEditingProject(project);
        setIsDialogOpen(true);
    };

    const handleSaveProject = async (data: Partial<Project>) => {
        if (editingProject) {
            await updateMutation.mutateAsync({ id: editingProject.id, data });
        } else {
            await createMutation.mutateAsync(data);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    const activeProjects = projects.filter(p => p.status !== 'archived');
    const archivedProjects = projects.filter(p => p.status === 'archived');

    const filteredProjects = (() => {
        let result = activeProjects;
        if (statusFilter !== 'all') {
            const normalized = statusFilter === 'on_hold' ? ['on_hold', 'paused'] : [statusFilter];
            result = result.filter(p => normalized.includes(p.status || ''));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.client || '').toLowerCase().includes(q) ||
                (p.description || '').replace(/<[^>]*>/g, ' ').toLowerCase().includes(q)
            );
        }
        return [...result].sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
            if (sortBy === 'date') return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
            return 0;
        });
    })();

    return (
        <>
            {selectedProject ? (
                <ProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onEdit={() => handleEditProject(selectedProject)}
                    isAdmin={user?.role === 'admin'}
                    onArchive={() => archiveMutation.mutate(selectedProject.id)}
                />
            ) : (
                <div className="p-6 space-y-6">
                    {/* ─── Toolbar ─────────────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</p>
                        </div>
                        {user?.role === 'admin' && (
                            <Button onClick={handleCreateProject} className="flex items-center gap-2 shrink-0">
                                <Plus className="w-4 h-4" />
                                New Project
                            </Button>
                        )}
                    </div>

                    {/* ─── Search + Filters ────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search projects..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[150px]">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="waiting_for_client_response">Waiting</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-9 w-[140px]">
                                <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Name (A–Z)</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="date">Start Date</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* ─── Project Grid ─────────────────────────────────────────── */}
                    {filteredProjects.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
                            <FolderKanban className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                            <p className="text-base font-medium text-muted-foreground">No projects found</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredProjects.map((project) => {
                                const sc = getStatusConfig(project.status);
                                const pendingCount = Number(project.pendingAccessCount || 0);
                                const dateOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: '2-digit' };
                                const plainDesc = (project.description || '').replace(/<[^>]*>/g, ' ').trim();

                                return (
                                    <div
                                        key={project.id}
                                        onClick={() => setSelectedProject(project)}
                                        className="group bg-card border border-border rounded-2xl cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.06] hover:-translate-y-0.5 hover:border-primary/20 flex flex-col"
                                        style={{ padding: '24px' }}
                                    >
                                        {/* ── Top Row: Name + Status ── */}
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h3 className="text-[15px] font-semibold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
                                                {project.name}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 whitespace-nowrap ${sc.text} ${sc.bg}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} flex-shrink-0`} />
                                                {sc.label}
                                            </span>
                                        </div>

                                        {/* ── Client name ── */}
                                        {project.client ? (
                                            <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
                                                <Building className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{project.client}</span>
                                            </p>
                                        ) : <div className="mb-2.5" />}

                                        {/* ── Description — fills remaining space ── */}
                                        <p
                                            className="text-xs text-muted-foreground line-clamp-3 flex-1 mb-3 leading-relaxed min-h-[3.75rem]"
                                            title={plainDesc}
                                        >
                                            {plainDesc || '\u00a0'}
                                        </p>

                                        {/* ── Pending access warning ── */}
                                        {pendingCount > 0 && (
                                            <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1.5 mb-3 text-[11px] font-medium">
                                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                                {pendingCount} pending access request{pendingCount > 1 ? 's' : ''}
                                            </div>
                                        )}



                                        {/* ── Meta Row ── */}
                                        <div className="pt-3 mt-3 border-t border-border space-y-2.5">
                                            {(project.managerName || project.assignedUserName) && (
                                                <div className="flex items-center gap-3">
                                                    {project.managerName && (
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Avatar name={project.managerName} colorClass="bg-violet-500" />
                                                            <div className="min-w-0">
                                                                <p className="text-[9px] text-muted-foreground leading-none uppercase tracking-wide">Manager</p>
                                                                <p className="text-[11px] font-medium text-foreground truncate">{project.managerName}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {project.managerName && project.assignedUserName && (
                                                        <div className="w-px h-6 bg-border flex-shrink-0" />
                                                    )}
                                                    {project.assignedUserName && (
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <Avatar name={project.assignedUserName} colorClass="bg-blue-500" />
                                                            <div className="min-w-0">
                                                                <p className="text-[9px] text-muted-foreground leading-none uppercase tracking-wide">Assigned</p>
                                                                <p className="text-[11px] font-medium text-foreground truncate">{project.assignedUserName}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Calendar className="w-3 h-3 flex-shrink-0" />
                                                <span suppressHydrationWarning>
                                                    {project.startDate ? new Date(project.startDate).toLocaleDateString('en-US', dateOpts) : 'No start'}
                                                </span>
                                                <span className="mx-0.5 opacity-40">—</span>
                                                <span suppressHydrationWarning>
                                                    {project.endDate ? new Date(project.endDate).toLocaleDateString('en-US', dateOpts) : 'No deadline'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ─── Archived Section ─────────────────────────────────────── */}
                    {archivedProjects.length > 0 && (
                        <div className="pt-6 border-t">
                            <Button
                                variant="ghost"
                                className="w-full flex justify-between items-center text-muted-foreground hover:text-foreground hover:bg-muted/30 mb-4"
                                onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                            >
                                <span className="font-semibold">Archived Projects ({archivedProjects.length})</span>
                                <span className="text-xs">{isArchiveExpanded ? 'Hide' : 'Show'}</span>
                            </Button>
                            {isArchiveExpanded && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {archivedProjects.map((project) => (
                                        <div
                                            key={project.id}
                                            className="bg-card border border-border rounded-2xl p-6 cursor-pointer opacity-60 hover:opacity-80 transition-opacity grayscale-[0.3]"
                                            onClick={() => setSelectedProject(project)}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <h3 className="font-semibold text-foreground truncate flex-1">{project.name}</h3>
                                                <Badge variant="outline" className="text-[10px] uppercase ml-2 shrink-0">Archived</Badge>
                                            </div>
                                            {project.client && (
                                                <p className="text-xs text-muted-foreground truncate">{project.client}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ProjectDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                project={editingProject}
                onSubmit={handleSaveProject}
            />
        </>
    );
}

function ProjectDetail({
    project,
    onBack,
    onEdit,
    isAdmin,
    onArchive,
}: {
    project: Project;
    onBack: () => void;
    onEdit: () => void;
    isAdmin: boolean;
    onArchive: () => void;
}) {
    const queryClient = useQueryClient();
    const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
    const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
    const [isTranscriptionDialogOpen, setIsTranscriptionDialogOpen] = useState(false);
    const [expandedMilestones, setExpandedMilestones] = useState<Record<number, boolean>>({});
    const [grantingAccessId, setGrantingAccessId] = useState<number | null>(null);
    const [adminEmail, setAdminEmail] = useState("");
    const [adminNotes, setAdminNotes] = useState("");
    const [accessStatus, setAccessStatus] = useState<number>(0);


    // Queries
    const { data: milestones = [] } = useQuery({
        queryKey: ['milestones', project.id],
        queryFn: () => projectsApi.getMilestones(project.id),
    });

    const { data: accessItems = [] } = useQuery({
        queryKey: ['access', project.id],
        queryFn: () => projectsApi.getAccessItems(project.id),
    });

    const { data: logs = [] } = useQuery({
        queryKey: ['logs', project.id],
        queryFn: () => projectsApi.getProjectLogs(project.id),
        refetchInterval: 5000, // Auto-refresh logs every 5s
    });

    const { data: transcriptions = [] } = useQuery({
        queryKey: ['transcriptions', project.id],
        queryFn: () => projectsApi.getTranscriptions(project.id),
    });

    const { data: files = [] } = useQuery({
        queryKey: ['project-files', project.id],
        queryFn: async () => {
            const response = await api.get(`/api/projects/${project.id}/files`);
            return response.data;
        },
    });

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) {
            return <ImageIcon className="w-5 h-5 text-purple-500" />;
        }
        if (ext === 'json') {
            return <FileJson className="w-5 h-5 text-blue-500" />;
        }
        return <FileText className="w-5 h-5 text-emerald-500" />;
    };

    const { data: projectTasks = [] } = useQuery({
        queryKey: ['tasks', 'project', project.id],
        queryFn: () => projectsApi.getProjectTasks(project.id),
    });

    // Optimization: Group tasks by milestone ID to avoid partial filtering in render loop
    const tasksByMilestone = useMemo(() => {
        const acc: Record<number, Task[]> = {};
        if (Array.isArray(projectTasks)) {
            projectTasks.forEach((t: Task) => {
                if (t.milestoneId) {
                    if (!acc[t.milestoneId]) acc[t.milestoneId] = [];
                    acc[t.milestoneId].push(t);
                }
            });
        }
        return acc;
    }, [projectTasks]);

    // Mutations
    const createMilestoneMutation = useMutation({
        mutationFn: (data: Partial<Milestone>) => projectsApi.createMilestone(project.id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
    });

    const updateMilestoneMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<Milestone> }) => projectsApi.updateMilestone(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['milestones', project.id] }),
    });

    const createAccessMutation = useMutation({
        mutationFn: (data: Partial<AccessItem>) => projectsApi.createAccessItem(project.id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['access', project.id] }),
    });

    const createTranscriptionMutation = useMutation({
        mutationFn: (data: any) => projectsApi.createTranscription(project.id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transcriptions', project.id] }),
    });

    const updateAccessMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<AccessItem> }) => projectsApi.updateAccessItem(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access', project.id] });
            setGrantingAccessId(null); // Close popover
        },
    });

    const uploadFileMutation = useMutation({
        mutationFn: (file: File) => {
            const formData = new FormData();
            formData.append('projectFile', file);
            return api.post(`/api/projects/${project.id}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-files', project.id] });
        },
    });

    const deleteFileMutation = useMutation({
        mutationFn: (fileId: number) => api.delete(`/api/projects/${project.id}/files/${fileId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project-files', project.id] });
        },
    });

    // Handlers
    const handleAddMilestone = (data: any) => {
        if (data.id) {
            updateMilestoneMutation.mutate({ id: data.id, data });
        } else {
            createMilestoneMutation.mutate(data);
        }
    };

    const handleEditMilestone = (milestone: Milestone) => {
        setEditingMilestone(milestone);
        setIsMilestoneDialogOpen(true);
    };

    const handleRequestAccess = (data: any) => createAccessMutation.mutate(data);
    const handleAddTranscription = (data: any) => createTranscriptionMutation.mutate(data);

    const toggleMilestoneTasks = (milestoneId: number) => {
        setExpandedMilestones(prev => ({
            ...prev,
            [milestoneId]: !prev[milestoneId]
        }));
    };

    const handleGrantAccess = (item: AccessItem) => {
        updateAccessMutation.mutate({
            id: item.id,
            data: {
                isGranted: accessStatus,
                grantedEmail: adminEmail,
                notes: adminNotes ? (item.notes ? item.notes + '\n\nAdmin: ' + adminNotes : adminNotes) : item.notes,
            }
        });
    };

    const handleUploadFile = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['json', 'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];
        if (!ext || !allowedExtensions.includes(ext)) {
            alert(`File type not supported. Please upload one of: ${allowedExtensions.join(', ')}`);
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // Front-end 10MB check
            alert('File is too large. Maximum size is 10MB.');
            return;
        }
        uploadFileMutation.mutate(file);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <Button variant="secondary" onClick={onBack} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Projects
                </Button>
                <div className="flex gap-2">
                    {isAdmin && project.status !== 'archived' && (
                        <Button
                            variant="destructive"
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => {
                                if (confirm('Are you sure you want to archive this project? It will be moved to the archive section.')) {
                                    onArchive();
                                }
                            }}
                        >
                            Archive Project
                        </Button>
                    )}
                    {isAdmin && <Button onClick={onEdit}>Edit Project</Button>}
                </div>
            </div>

            <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
                        {project.client && <p className="text-muted-foreground">Client: {project.client}</p>}
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status?.replace('_', ' ')}
                    </Badge>
                </div>

                {project.description && (
                    <div
                        className="text-muted-foreground mb-4 prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: project.description }}
                    />
                )}

                <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Start: {safeFormatDate(project.startDate)}</span>
                    <span>Target End: {safeFormatDate(project.endDate)}</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Milestones</h3>
                        <Button size="sm" variant="outline" onClick={() => setIsMilestoneDialogOpen(true)}>
                            + Add Milestone
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {milestones.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No milestones yet.</p>
                        ) : (
                            milestones.map((m: Milestone) => (
                                <div key={m.id} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="font-medium">{m.title}</p>
                                        <div className="flex items-center gap-2">
                                            {isAdmin && (
                                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEditMilestone(m)}>
                                                    <Edit3 size={12} />
                                                </Button>
                                            )}
                                            <Badge variant="outline">{m.status.replace('_', ' ')}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Due: {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'No date'}</span>
                                    </div>
                                    {m.details && (
                                        <MilestoneDetails details={m.details} />
                                    )}

                                    {/* Milestone Tasks */}
                                    <div className="mt-3 space-y-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-between h-7 text-[10px] hover:bg-muted/50"
                                            onClick={() => toggleMilestoneTasks(m.id)}
                                        >
                                            <span>Tasks ({(tasksByMilestone[m.id] || []).length})</span>
                                            <span className="text-muted-foreground">{expandedMilestones[m.id] ? 'Hide' : 'Show'}</span>
                                        </Button>
                                        {expandedMilestones[m.id] && (
                                            <div className="space-y-1.5 pt-1 border-t border-muted/20">
                                                {(tasksByMilestone[m.id] || []).map((t: Task) => (
                                                    <div key={t.id} className="bg-muted/30 rounded p-2 text-xs border border-muted flex justify-between items-center group hover:bg-muted/50 transition-colors">
                                                        <span className="font-medium truncate mr-2" title={t.title}>{t.title}</span>
                                                        <Badge variant="outline" className="text-[10px] h-4 shrink-0 px-1">
                                                            {t.status.replace('_', ' ')}
                                                        </Badge>
                                                    </div>
                                                ))}
                                                {(tasksByMilestone[m.id] || []).length === 0 && (
                                                    <p className="text-[10px] text-muted-foreground text-center py-2 italic">No tasks found</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card className="p-6 order-3">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Client Access Required</h3>
                        <Button size="sm" variant="outline" onClick={() => setIsAccessDialogOpen(true)}>
                            + Request Access
                        </Button>
                    </div>
                    <div className="space-y-4">
                        {accessItems.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No access items requested yet.</p>
                        ) : (
                            accessItems.map((item: AccessItem) => (
                                <Popover key={item.id} onOpenChange={(open: boolean) => {
                                    if (open) {
                                        setGrantingAccessId(item.id);
                                        setAdminEmail(item.grantedEmail || "");
                                        setAdminNotes("");
                                        setAccessStatus(item.isGranted || 0);
                                    }
                                }}>
                                    <PopoverTrigger asChild>
                                        <div
                                            className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${!item.isGranted
                                                ? 'border-l-4 border-l-yellow-500 bg-yellow-50/10'
                                                : 'border-l-4 border-l-green-500'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="font-medium">{item.platform}</p>
                                                {!item.isGranted && <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>}
                                                {item.isGranted === 1 && <Badge variant="secondary" className="bg-green-500/20 text-green-600">Granted</Badge>}
                                                {item.isGranted === 2 && <Badge variant="secondary" className="bg-red-500/20 text-red-600">Denied</Badge>}
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-1">{item.description}</p>
                                            {item.isGranted === 1 && item.grantedEmail && <p className="text-xs text-green-600">Access via: {item.grantedEmail}</p>}
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        {isAdmin ? (
                                            <div className="grid gap-4">
                                                <div className="space-y-2">
                                                    <h4 className="font-medium leading-none">Manage Access</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Update access details or change status.
                                                    </p>
                                                </div>
                                                <div className="grid gap-2">
                                                    <div className="grid grid-cols-3 items-center gap-4">
                                                        <label htmlFor="status" className="text-xs">Status</label>
                                                        <Select value={accessStatus.toString()} onValueChange={(val) => setAccessStatus(parseInt(val))}>
                                                            <SelectTrigger className="col-span-2 h-8">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="0">Pending</SelectItem>
                                                                <SelectItem value="1">Granted</SelectItem>
                                                                <SelectItem value="2">Denied</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid grid-cols-3 items-center gap-4">
                                                        <label htmlFor="email" className="text-xs">Email</label>
                                                        <Input
                                                            id="email"
                                                            value={adminEmail}
                                                            onChange={(e) => setAdminEmail(e.target.value)}
                                                            className="col-span-2 h-8"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-3 items-center gap-4">
                                                        <label htmlFor="notes" className="text-xs">Notes</label>
                                                        <Textarea
                                                            id="notes"
                                                            value={adminNotes}
                                                            onChange={(e) => setAdminNotes(e.target.value)}
                                                            className="col-span-2 h-16 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                                <Button size="sm" onClick={() => handleGrantAccess(item)}>
                                                    Update Status
                                                </Button>
                                            </div>
                                        ) : item.isGranted === 1 ? (
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">Access Granted</h4>
                                                <div className="text-sm text-muted-foreground">
                                                    <p><strong>Platform:</strong> {item.platform}</p>
                                                    <p><strong>Email:</strong> {item.grantedEmail || 'N/A'}</p>
                                                    <p><strong>Notes:</strong> {item.notes || 'None'}</p>
                                                    <p className="text-xs mt-2 text-right" suppressHydrationWarning>Granted on {new Date(item.grantedAt || '').toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-muted-foreground">
                                                Access status: {item.isGranted === 2 ? 'Denied' : 'Pending'}
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            ))
                        )}
                    </div>
                </Card>
                <Card className="p-6 order-2">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Project Files & Documents</h3>
                        <div className="relative">
                            <Button size="sm" variant="outline" asChild>
                                <label className="cursor-pointer">
                                    + Upload File
                                    <input
                                        type="file"
                                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadFile(file);
                                        }}
                                        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} // Reset to allow re-uploading same file
                                    />
                                </label>
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {files.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No files uploaded yet.</p>
                        ) : (
                            files.map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                    <div className="flex items-center gap-3 min-w-0 pr-4">
                                        {getFileIcon(file.name)}
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm truncate">{file.name}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                Added by {file.userName} on {new Date(file.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" asChild>
                                            <a href={file.path} download={file.name}>Download</a>
                                        </Button>
                                        {isAdmin && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-600"
                                                onClick={() => deleteFileMutation.mutate(file.id)}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div >

            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Meeting Transcriptions</h3>
                    <Button size="sm" variant="outline" onClick={() => setIsTranscriptionDialogOpen(true)}>
                        + Add Transcription
                    </Button>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {transcriptions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No transcriptions yet.</p>
                    ) : (
                        transcriptions.map((t: any) => (
                            <div key={t.id} className="border rounded-lg p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold">{t.title}</h4>
                                    <span className="text-xs text-muted-foreground" suppressHydrationWarning>{new Date(t.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md max-h-40 overflow-y-auto">
                                    {t.content}
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground text-right">
                                    Added by {t.createdByName || 'User'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Progress Logs</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {logs.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No activity logs yet.</p>
                    ) : (
                        logs.map((log: ProjectLog) => (
                            <div key={log.id} className="flex gap-4 py-2 text-sm border-b last:border-0 border-muted/30">
                                <div className="text-muted-foreground whitespace-nowrap min-w-[180px] flex-none italic" suppressHydrationWarning>
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                                <div className="flex-1">
                                    <span className="font-bold text-foreground">{log.userName || 'System'}: </span>
                                    <span className="text-muted-foreground">{log.message}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            <MilestoneDialog
                open={isMilestoneDialogOpen}
                onOpenChange={(open) => {
                    setIsMilestoneDialogOpen(open);
                    if (!open) setEditingMilestone(null);
                }}
                onSubmit={handleAddMilestone}
                milestone={editingMilestone}
            />

            <AccessRequestDialog
                open={isAccessDialogOpen}
                onOpenChange={setIsAccessDialogOpen}
                onSubmit={handleRequestAccess}
            />

            <TranscriptionDialog
                open={isTranscriptionDialogOpen}
                onOpenChange={setIsTranscriptionDialogOpen}
                onSubmit={handleAddTranscription}
            />
        </div >
    );
}

const MilestoneDetails = React.memo(({ details }: { details: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Increased threshold for rendering full content, but we'll use CSS to hide it
    const isAstronomical = details.length > 2000000; // 2MB+

    return (
        <div className="mt-2 text-[10px] relative">
            <div
                className={`text-xs text-muted-foreground prose prose-xs dark:prose-invert max-w-none break-words overflow-hidden transition-all duration-300 ${!isExpanded ? 'max-h-[150px] relative' : 'max-h-none'
                    }`}
                dangerouslySetInnerHTML={{
                    __html: isAstronomical && !isExpanded
                        ? details.substring(0, 5000) + "... (Astronomical content truncated for safety)"
                        : details
                }}
            />
            {!isExpanded && !isAstronomical && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
            )}
            {(details.length > 500 || isAstronomical) && (
                <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-[10px] mt-1 relative z-10"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                >
                    {isExpanded ? 'Show less' : 'Show more'}
                </Button>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.details === nextProps.details;
});

MilestoneDetails.displayName = 'MilestoneDetails';
