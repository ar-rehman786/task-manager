'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Project } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';

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

    const { data: projects = [], isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.getProjects,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (selectedProject) {
        return <ProjectDetail project={selectedProject} onBack={() => setSelectedProject(null)} />;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Projects</h1>
                {user?.role === 'admin' && <Button>+ New Project</Button>}
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
                            <span
                                className={`text-xs px-2 py-1 rounded ${project.status === 'active'
                                        ? 'bg-green-500/20 text-green-600'
                                        : project.status === 'on_hold'
                                            ? 'bg-yellow-500/20 text-yellow-600'
                                            : 'bg-blue-500/20 text-blue-600'
                                    }`}
                            >
                                {project.status?.replace('_', ' ')}
                            </span>
                        </div>

                        {project.client && (
                            <p className="text-sm text-muted-foreground mb-2">Client: {project.client}</p>
                        )}

                        {project.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                {project.description}
                            </p>
                        )}

                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                            <span>End: {new Date(project.endDate).toLocaleDateString()}</span>
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
    );
}

function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
    return (
        <div className="p-6 space-y-6">
            <Button variant="secondary" onClick={onBack}>
                ← Back to Projects
            </Button>

            <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">{project.name}</h2>
                        {project.client && <p className="text-muted-foreground">Client: {project.client}</p>}
                    </div>
                    <span
                        className={`text-sm px-3 py-1 rounded ${project.status === 'active'
                                ? 'bg-green-500/20 text-green-600'
                                : project.status === 'on_hold'
                                    ? 'bg-yellow-500/20 text-yellow-600'
                                    : 'bg-blue-500/20 text-blue-600'
                            }`}
                    >
                        {project.status?.replace('_', ' ')}
                    </span>
                </div>

                {project.description && <p className="text-muted-foreground mb-4">{project.description}</p>}

                <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                    <span>Target End: {new Date(project.endDate).toLocaleDateString()}</span>
                </div>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Milestones</h3>
                <p className="text-muted-foreground">No milestones yet.</p>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Client Access Required</h3>
                <p className="text-muted-foreground">No access items requested yet.</p>
            </Card>

            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Progress Logs</h3>
                <p className="text-muted-foreground">No logs yet.</p>
            </Card>
        </div>
    );
}
