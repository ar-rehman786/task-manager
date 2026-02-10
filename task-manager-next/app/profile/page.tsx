'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tantml:query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { usersApi } from '@/lib/api/users';

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}

function ProfileContent() {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
    });

    const updateProfileMutation = useMutation({
        mutationFn: (data: Partial<typeof formData>) => usersApi.updateUser(user!.id, data),
        onSuccess: (updatedUser) => {
            setUser(updatedUser);
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Profile Settings</h1>

            {/* Profile Information */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Personal Information</h2>
                    {!isEditing && (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                            Edit Profile
                        </Button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Name</label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Your name"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Email</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="your.email@company.com"
                                required
                            />
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={updateProfileMutation.isPending}>
                                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({ name: user?.name || '', email: user?.email || '' });
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Name
                            </label>
                            <p className="text-lg">{user?.name}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Email
                            </label>
                            <p className="text-lg">{user?.email}</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">
                                Role
                            </label>
                            <span
                                className={`inline-block px-3 py-1 rounded text-sm font-medium ${user?.role === 'admin'
                                        ? 'bg-purple-500/20 text-purple-600'
                                        : 'bg-blue-500/20 text-blue-600'
                                    }`}
                            >
                                {user?.role}
                            </span>
                        </div>
                    </div>
                )}
            </Card>

            {/* Account Settings */}
            <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Account Settings</h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="font-medium mb-2">Password</h3>
                        <Button variant="outline">Change Password</Button>
                    </div>

                    <div className="pt-4 border-t">
                        <h3 className="font-medium mb-2 text-destructive">Danger Zone</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Deleting your account is permanent and cannot be undone.
                        </p>
                        <Button variant="destructive">Delete Account</Button>
                    </div>
                </div>
            </Card>

            {/* Preferences */}
            <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Preferences</h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium">Email Notifications</h3>
                            <p className="text-sm text-muted-foreground">
                                Receive email notifications for task updates
                            </p>
                        </div>
                        <input type="checkbox" className="w-4 h-4" defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium">Desktop Notifications</h3>
                            <p className="text-sm text-muted-foreground">
                                Show browser notifications for updates
                            </p>
                        </div>
                        <input type="checkbox" className="w-4 h-4" defaultChecked />
                    </div>
                </div>
            </Card>
        </div>
    );
}
