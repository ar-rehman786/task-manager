'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import api from '@/lib/api/client';
import { Project, Milestone, AccessItem, ProjectLog } from '@/lib/types';
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
import { Edit3 } from 'lucide-react';

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

    return (
        <>
            {selectedProject ? (
                <ProjectDetail
                    project={selectedProject}
                    onBack={() => setSelectedProject(null)}
                    onEdit={() => handleEditProject(selectedProject)}
                    isAdmin={user?.role === 'admin'}
                />
            ) : (
                <div className="p-6 space-y-6">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold">Projects</h1>
                        {user?.role === 'admin' && (
                            <Button onClick={handleCreateProject}>+ New Project</Button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Card
                                key={project.id}
                                className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => setSelectedProject(project)}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-semibold">{project.name}</h3>
                                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                                        {project.status?.replace('_', ' ')}
                                    </Badge>
                                </div>

                                {project.client && (
                                    <p className="text-sm text-muted-foreground mb-2">Client: {project.client}</p>
                                )}

                                {project.description && (
                                    <div
                                        className="text-sm text-muted-foreground mb-4 line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
                                        dangerouslySetInnerHTML={{ __html: project.description.substring(0, 200) }}
                                    />
                                )}

                                <div className="space-y-1 mb-4">
                                    {project.managerName && (
                                        <p className="text-xs text-muted-foreground">Manager: <span className="font-medium text-foreground">{project.managerName}</span></p>
                                    )}
                                    {project.assignedUserName && (
                                        <p className="text-xs text-muted-foreground">Assigned: <span className="font-medium text-foreground">{project.assignedUserName}</span></p>
                                    )}
                                </div>

                                {(() => {
                                    const pendingCount = Number(project.pendingAccessCount || 0);
                                    return pendingCount > 0 && (
                                        <div className="mb-4">
                                            <Badge variant="destructive" className="w-full justify-center py-1">
                                                {pendingCount} Pending Access Request{pendingCount > 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                    );
                                })()}

                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span suppressHydrationWarning>Start: {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}</span>
                                    <span suppressHydrationWarning>End: {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                            </Card>
                        ))}
                    </div>

                    {projects.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">No projects yet. Create one to get started!</p>
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
}: {
    project: Project;
    onBack: () => void;
    onEdit: () => void;
    isAdmin: boolean;
}) {
    const queryClient = useQueryClient();
    const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
    const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
    const [isTranscriptionDialogOpen, setIsTranscriptionDialogOpen] = useState(false);
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
        if (!file.name.endsWith('.json')) {
            alert('Please upload a JSON file');
            return;
        }
        uploadFileMutation.mutate(file);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <Button variant="secondary" onClick={onBack}>
                    ← Back to Projects
                </Button>
                {isAdmin && <Button onClick={onEdit}>Edit Project</Button>}
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
                    <span>Start: {new Date(project.startDate || '').toLocaleDateString()}</span>
                    <span>Target End: {new Date(project.endDate || '').toLocaleDateString()}</span>
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
                                        <div
                                            className="text-xs text-muted-foreground mt-2 prose prose-xs dark:prose-invert max-w-none"
                                            dangerouslySetInnerHTML={{ __html: m.details }}
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                <Card className="p-6">
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
                                            className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${!item.isGranted ? 'border-l-4 border-l-yellow-500 bg-yellow-50/10' : 'border-l-4 border-l-green-500'
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
                                    {isAdmin && (
                                        <PopoverContent className="w-80">
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
                                        </PopoverContent>
                                    )}
                                    {!isAdmin && item.isGranted === 1 && (
                                        <PopoverContent className="w-80">
                                            <div className="space-y-2">
                                                <h4 className="font-medium leading-none">Access Granted</h4>
                                                <div className="text-sm text-muted-foreground">
                                                    <p><strong>Platform:</strong> {item.platform}</p>
                                                    <p><strong>Email:</strong> {item.grantedEmail || 'N/A'}</p>
                                                    <p><strong>Notes:</strong> {item.notes || 'None'}</p>
                                                    <p className="text-xs mt-2 text-right" suppressHydrationWarning>Granted on {new Date(item.grantedAt || '').toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    )}
                                </Popover>
                            ))
                        )}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Project JSON Files</h3>
                        <div className="relative">
                            <Button size="sm" variant="outline" asChild>
                                <label className="cursor-pointer">
                                    + Upload JSON
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleUploadFile(file);
                                        }}
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
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">📄</span>
                                        <div>
                                            <p className="font-medium text-sm">{file.name}</p>
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
                            <div key={log.id} className="flex gap-3 text-sm">
                                <div className="text-muted-foreground whitespace-nowrap w-32" suppressHydrationWarning>
                                    {new Date(log.createdAt).toLocaleString()}
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">{log.userName || 'System'}: </span>
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
