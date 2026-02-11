'use client';

import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, MapPin, Mail, Phone } from 'lucide-react';
import ProtectedRoute from '@/components/protected-route';

export default function OrganizationPage() {
    return (
        <ProtectedRoute>
            <OrganizationContent />
        </ProtectedRoute>
    );
}

function OrganizationContent() {
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

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Organization Directory</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                    <Card key={user.id} className="p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start gap-4">
                            <Avatar className="w-16 h-16 border-2 border-primary/10">
                                <AvatarImage src={user.profilePicture} alt={user.name} />
                                <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl">
                                    {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold truncate">{user.name}</h3>
                                <p className="text-sm text-primary font-medium flex items-center gap-1 mb-2">
                                    <Briefcase size={14} /> {user.title || 'Team Member'}
                                </p>

                                <div className="space-y-1 text-sm text-muted-foreground">
                                    <p className="flex items-center gap-2 truncate">
                                        <Mail size={14} className="shrink-0" /> {user.email}
                                    </p>
                                    {user.phone && (
                                        <p className="flex items-center gap-2">
                                            <Phone size={14} className="shrink-0" /> {user.phone}
                                        </p>
                                    )}
                                    {user.location && (
                                        <p className="flex items-center gap-2">
                                            <MapPin size={14} className="shrink-0" /> {user.location}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-border">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                                        Department: <span className="text-foreground">{user.department || 'General'}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {users.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">No team members found.</p>
                </div>
            )}
        </div>
    );
}
