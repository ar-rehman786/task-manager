'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';

export default function TeamPage() {
    return (
        <ProtectedRoute>
            <TeamContent />
        </ProtectedRoute>
    );
}

function TeamContent() {
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.user);

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.getUsers,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (currentUser?.role !== 'admin') {
        return (
            <div className="p-6">
                <Card className="p-12 text-center">
                    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                    <p className="text-muted-foreground">
                        You need admin privileges to access the team management page.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Team Members</h1>
                <Button>+ Add Member</Button>
            </div>

            <Card className="p-6">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-4">Name</th>
                                <th className="text-left py-3 px-4">Email</th>
                                <th className="text-left py-3 px-4">Role</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-left py-3 px-4">Joined</th>
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-semibold">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                                    <td className="py-3 px-4">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin'
                                                    ? 'bg-purple-500/20 text-purple-600'
                                                    : 'bg-blue-500/20 text-blue-600'
                                                }`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="text-green-600">● Active</span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground">
                                        {user.createdAt
                                            ? new Date(user.createdAt).toLocaleDateString()
                                            : 'N/A'}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <Button variant="ghost" size="sm">
                                            Edit
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {users.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No team members found.</p>
                </div>
            )}
        </div>
    );
}
