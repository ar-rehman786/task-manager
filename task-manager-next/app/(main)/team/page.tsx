'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { UserEditDialog } from '@/components/team/user-edit-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';

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
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);
    const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'member' as 'admin' | 'member' });
    const [addError, setAddError] = useState('');

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.getUsers,
    });

    const updateUserMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => usersApi.updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsEditDialogOpen(false);
            setEditingUser(null);
        },
    });

    const createUserMutation = useMutation({
        mutationFn: (data: { name: string; email: string; password: string; role: string }) => usersApi.createUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsAddDialogOpen(false);
            setAddForm({ name: '', email: '', password: '', role: 'member' });
            setAddError('');
        },
        onError: (error: any) => {
            setAddError(error.response?.data?.error || 'Failed to create user');
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: (id: number) => usersApi.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsDeleteDialogOpen(false);
            setDeletingUser(null);
        },
    });

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsEditDialogOpen(true);
    };

    const handleSaveUser = (id: number, data: Partial<User>) => {
        updateUserMutation.mutate({ id, data });
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        if (!addForm.name || !addForm.email || !addForm.password) {
            setAddError('All fields are required');
            return;
        }
        if (addForm.password.length < 6) {
            setAddError('Password must be at least 6 characters');
            return;
        }
        createUserMutation.mutate(addForm);
    };

    const handleDeleteClick = (user: User) => {
        setDeletingUser(user);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (deletingUser) {
            deleteUserMutation.mutate(deletingUser.id);
        }
    };

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
                <Button onClick={() => {
                    setAddForm({ name: '', email: '', password: '', role: 'member' });
                    setAddError('');
                    setIsAddDialogOpen(true);
                }}>+ Add Member</Button>
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
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                                                Edit
                                            </Button>
                                            {user.id !== currentUser?.id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteClick(user)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            )}
                                        </div>
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

            {/* Edit User Dialog */}
            <UserEditDialog
                user={editingUser}
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onSave={handleSaveUser}
                isPending={updateUserMutation.isPending}
            />

            {/* Add Member Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Team Member</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddUser}>
                        <div className="grid gap-4 py-4">
                            {addError && (
                                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{addError}</div>
                            )}
                            <div className="grid gap-2">
                                <Label>Full Name</Label>
                                <Input
                                    value={addForm.name}
                                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Email Address</Label>
                                <Input
                                    type="email"
                                    value={addForm.email}
                                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Password</Label>
                                <Input
                                    type="password"
                                    value={addForm.password}
                                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                                    placeholder="Min 6 characters"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Role</Label>
                                <Select value={addForm.role} onValueChange={(val: 'admin' | 'member') => setAddForm({ ...addForm, role: val })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={createUserMutation.isPending}>
                                {createUserMutation.isPending ? 'Creating...' : 'Add Member'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Team Member</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-muted-foreground">
                            Are you sure you want to delete <span className="font-semibold text-foreground">{deletingUser?.name}</span>?
                            This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleteUserMutation.isPending}
                        >
                            {deleteUserMutation.isPending ? 'Deleting...' : 'Delete Member'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
