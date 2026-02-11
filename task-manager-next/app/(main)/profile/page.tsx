'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ProtectedRoute from '@/components/protected-route';
import { useAuthStore } from '@/lib/store/authStore';
import { usersApi } from '@/lib/api/users';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Camera, MapPin, Briefcase, Phone, Hash, User as UserIcon } from 'lucide-react';
import api from '@/lib/api/client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

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
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        title: user?.title || '',
        department: user?.department || '',
        location: user?.location || '',
        phone: user?.phone || '',
        employeeId: user?.employeeId || '',
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (data: Partial<typeof formData>) => {
            const response = await api.put('/api/users/profile', data);
            return response.data;
        },
        onSuccess: (updatedUser) => {
            setUser(updatedUser);
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const uploadPhotoMutation = useMutation({
        mutationFn: async (file: File) => {
            const uploadData = new FormData();
            uploadData.append('profilePicture', file);
            const response = await api.put('/api/users/profile', uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        },
        onSuccess: (updatedUser) => {
            setUser(updatedUser);
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const changePasswordMutation = useMutation({
        mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
            const response = await api.put('/api/users/change-password', data);
            return response.data;
        },
        onSuccess: () => {
            setPasswordSuccess('Password changed successfully!');
            setPasswordError('');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                setIsPasswordDialogOpen(false);
                setPasswordSuccess('');
            }, 1500);
        },
        onError: (error: any) => {
            setPasswordError(error.response?.data?.error || 'Failed to change password');
            setPasswordSuccess('');
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadPhotoMutation.mutate(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    const handlePasswordChange = () => {
        setPasswordError('');
        setPasswordSuccess('');
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters');
            return;
        }
        changePasswordMutation.mutate({
            currentPassword: passwordData.currentPassword,
            newPassword: passwordData.newPassword,
        });
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-end">
                <div className="flex gap-6 items-end">
                    <div className="relative group">
                        <Avatar className="w-32 h-32 border-4 border-background shadow-xl">
                            <AvatarImage src={user?.profilePicture} alt={user?.name} />
                            <AvatarFallback className="text-4xl bg-primary text-primary-foreground">
                                {user?.name?.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform">
                            <Camera size={20} />
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{user?.name}</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <Briefcase size={16} /> {user?.title || 'No Title Set'} • {user?.department || 'General'}
                        </p>
                    </div>
                </div>
                {!isEditing && (
                    <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 p-6">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <UserIcon size={20} className="text-primary" /> Personal Information
                    </h2>

                    {isEditing ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Job Title</Label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Senior Developer"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Department</Label>
                                    <Input
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="e.g. Engineering"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Location</Label>
                                    <Input
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="e.g. London, UK"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Employee ID</Label>
                                    <Input
                                        value={formData.employeeId}
                                        onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                        placeholder="EMP-001"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button type="submit" disabled={updateProfileMutation.isPending}>
                                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
                                            name: user?.name || '',
                                            email: user?.email || '',
                                            title: user?.title || '',
                                            department: user?.department || '',
                                            location: user?.location || '',
                                            phone: user?.phone || '',
                                            employeeId: user?.employeeId || '',
                                        });
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Full Name</p>
                                <p className="font-medium">{user?.name}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Email Address</p>
                                <p className="font-medium">{user?.email}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Location</p>
                                <p className="font-medium flex items-center gap-1">
                                    <MapPin size={14} /> {user?.location || 'Not set'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Phone</p>
                                <p className="font-medium flex items-center gap-1">
                                    <Phone size={14} /> {user?.phone || 'Not set'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Employee ID</p>
                                <p className="font-medium flex items-center gap-1">
                                    <Hash size={14} /> {user?.employeeId || 'Not set'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Role</p>
                                <span className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {user?.role}
                                </span>
                            </div>
                        </div>
                    )}
                </Card>

                <div className="space-y-6">
                    <Card className="p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Briefcase size={18} className="text-primary" /> Work Details
                        </h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Department</span>
                                <span className="font-medium">{user?.department || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b">
                                <span className="text-muted-foreground">Manager</span>
                                <span className="font-medium">{user?.managerName || 'Direct'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-muted-foreground">Joined</span>
                                <span className="font-medium">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recent'}</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 border-destructive/20 bg-destructive/5">
                        <h3 className="font-semibold text-destructive mb-4">Security</h3>
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start text-xs h-8"
                                onClick={() => {
                                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                    setPasswordError('');
                                    setPasswordSuccess('');
                                    setIsPasswordDialogOpen(true);
                                }}
                            >
                                Change Password
                            </Button>
                            <Button variant="ghost" className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 h-8">Delete Account</Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Password Change Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {passwordError && (
                            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{passwordError}</div>
                        )}
                        {passwordSuccess && (
                            <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">{passwordSuccess}</div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                                id="current-password"
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handlePasswordChange} disabled={changePasswordMutation.isPending}>
                            {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
