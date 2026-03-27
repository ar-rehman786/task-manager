'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/authStore';
import {
    CalendarPlus, Handshake, Phone as PhoneIcon, DollarSign, TrendingUp,
    Building2, User, Clock, Trash2, Loader2, Plus, MapPin, Mail,
    FileText, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Appointment {
    id: number;
    businessName: string;
    ownerName: string;
    phone: string;
    email?: string;
    address?: string;
    appointmentDate: string;
    assignedCloserId?: number;
    assignedCloserName?: string;
    notes?: string;
    status: 'upcoming' | 'completed' | 'no_show';
    createdBy: number;
    creatorName: string;
    createdAt: string;
}

interface ClosedDeal {
    id: number;
    businessName: string;
    ownerName: string;
    phone: string;
    email?: string;
    address?: string;
    packageSold: string;
    monthlyPlan: string;
    notes?: string;
    closedBy: number;
    closerName: string;
    createdAt: string;
}

interface OutreachStats {
    totalCallsToday: number;
    appointmentsThisWeek: number;
    dealsClosedThisWeek: number;
    revenueThisWeek: number;
}

interface TeamMember {
    id: number;
    name: string;
    role: string;
}

const statusConfig: Record<string, { label: string; text: string; bg: string; dot: string }> = {
    upcoming: { label: 'Upcoming', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20', dot: 'bg-blue-500' },
    completed: { label: 'Completed', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20', dot: 'bg-emerald-500' },
    no_show: { label: 'No Show', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-400/10 border-rose-200 dark:border-rose-400/20', dot: 'bg-rose-500' },
};

export default function AppointmentsPage() {
    return (
        <ProtectedRoute>
            <AppointmentsContent />
        </ProtectedRoute>
    );
}

function AppointmentsContent() {
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const isAdmin = user?.role === 'admin';
    const [activeTab, setActiveTab] = useState<'appointments' | 'deals'>('appointments');
    const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
    const [showDealDialog, setShowDealDialog] = useState(false);

    // Fetch stats (admin only)
    const { data: stats } = useQuery({
        queryKey: ['outreach-stats'],
        queryFn: async () => {
            const response = await api.get<OutreachStats>('/api/outreach/stats');
            return response.data;
        },
        enabled: isAdmin,
    });

    // Fetch team members for closer dropdown
    const { data: teamMembers = [] } = useQuery({
        queryKey: ['team-members'],
        queryFn: async () => {
            const response = await api.get<TeamMember[]>('/api/team-members');
            return response.data;
        },
    });

    // Fetch appointments
    const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
        queryKey: ['appointments'],
        queryFn: async () => {
            const response = await api.get<Appointment[]>('/api/appointments');
            return response.data;
        },
    });

    // Fetch closed deals
    const { data: deals = [], isLoading: loadingDeals } = useQuery({
        queryKey: ['closed-deals'],
        queryFn: async () => {
            const response = await api.get<ClosedDeal[]>('/api/closed-deals');
            return response.data;
        },
    });

    return (
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Appointments & Leads</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage appointments and track closed deals</p>
            </div>

            {/* Admin Stats */}
            {isAdmin && stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={PhoneIcon} label="Total Calls Today" value={stats.totalCallsToday} color="text-primary" />
                    <StatCard icon={CalendarPlus} label="Appointments This Week" value={stats.appointmentsThisWeek} color="text-blue-500" />
                    <StatCard icon={Handshake} label="Deals Closed This Week" value={stats.dealsClosedThisWeek} color="text-emerald-500" />
                    <StatCard icon={DollarSign} label="Revenue This Week" value={`$${stats.revenueThisWeek.toLocaleString()}`} color="text-amber-500" />
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('appointments')}
                    className={cn(
                        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                        activeTab === 'appointments'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                >
                    Appointments
                </button>
                <button
                    onClick={() => setActiveTab('deals')}
                    className={cn(
                        'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                        activeTab === 'deals'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                >
                    Closed Deals
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'appointments' ? (
                <AppointmentsTab
                    appointments={appointments}
                    isLoading={loadingAppointments}
                    teamMembers={teamMembers}
                    isAdmin={isAdmin}
                    userId={user?.id}
                    showDialog={showAppointmentDialog}
                    setShowDialog={setShowAppointmentDialog}
                />
            ) : (
                <DealsTab
                    deals={deals}
                    isLoading={loadingDeals}
                    isAdmin={isAdmin}
                    showDialog={showDealDialog}
                    setShowDialog={setShowDealDialog}
                />
            )}
        </div>
    );
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
    return (
        <Card>
            <CardContent className="p-4 flex items-center gap-4">
                <div className={cn('p-2.5 rounded-lg bg-accent/50', color)}>
                    <Icon size={20} />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="text-xl font-bold mt-0.5">{value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Appointments Tab ───────────────────────────────────
function AppointmentsTab({
    appointments, isLoading, teamMembers, isAdmin, userId, showDialog, setShowDialog,
}: {
    appointments: Appointment[];
    isLoading: boolean;
    teamMembers: TeamMember[];
    isAdmin: boolean;
    userId?: number;
    showDialog: boolean;
    setShowDialog: (v: boolean) => void;
}) {
    const queryClient = useQueryClient();

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: string }) => {
            const response = await api.patch(`/api/appointments/${id}`, { status });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            toast.success('Status updated');
        },
        onError: () => toast.error('Failed to update status'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => { await api.delete(`/api/appointments/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            toast.success('Appointment deleted');
        },
        onError: () => toast.error('Failed to delete'),
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setShowDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    New Appointment
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
                </div>
            ) : appointments.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <CalendarPlus size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No appointments yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {appointments.map((apt) => {
                        const sc = statusConfig[apt.status];
                        const canUpdateStatus = isAdmin || apt.assignedCloserId === userId;
                        return (
                            <Card key={apt.id} className="relative group">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-[15px]">{apt.businessName}</h3>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                <User size={13} /> {apt.ownerName}
                                            </p>
                                        </div>
                                        <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border', sc.text, sc.bg)}>
                                            <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
                                            {sc.label}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5 text-sm text-muted-foreground">
                                        <p className="flex items-center gap-2"><PhoneIcon size={13} /> {apt.phone}</p>
                                        {apt.email && <p className="flex items-center gap-2"><Mail size={13} /> {apt.email}</p>}
                                        {apt.address && <p className="flex items-center gap-2"><MapPin size={13} /> {apt.address}</p>}
                                        <p className="flex items-center gap-2">
                                            <Clock size={13} />
                                            {new Date(apt.appointmentDate).toLocaleDateString('en-US', {
                                                weekday: 'short', month: 'short', day: 'numeric',
                                            })}{' '}
                                            {new Date(apt.appointmentDate).toLocaleTimeString('en-US', {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </p>
                                        {apt.assignedCloserName && (
                                            <p className="flex items-center gap-2">
                                                <Handshake size={13} /> {apt.assignedCloserName}
                                            </p>
                                        )}
                                        {apt.notes && (
                                            <p className="flex items-start gap-2 pt-1">
                                                <FileText size={13} className="mt-0.5 shrink-0" />
                                                <span className="line-clamp-2">{apt.notes}</span>
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        {canUpdateStatus ? (
                                            <select
                                                value={apt.status}
                                                onChange={(e) => updateStatusMutation.mutate({ id: apt.id, status: e.target.value })}
                                                className="text-xs font-medium rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="upcoming">Upcoming</option>
                                                <option value="completed">Completed</option>
                                                <option value="no_show">No Show</option>
                                            </select>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">By {apt.creatorName}</span>
                                        )}
                                        {isAdmin && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => deleteMutation.mutate(apt.id)}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <AppointmentDialog
                open={showDialog}
                onOpenChange={setShowDialog}
                teamMembers={teamMembers}
            />
        </div>
    );
}

// ─── Appointment Dialog ─────────────────────────────────
function AppointmentDialog({
    open, onOpenChange, teamMembers,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    teamMembers: TeamMember[];
}) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        businessName: '', ownerName: '', phone: '', email: '', address: '',
        appointmentDate: '', assignedCloserId: '', notes: '',
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await api.post('/api/appointments', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            onOpenChange(false);
            setForm({ businessName: '', ownerName: '', phone: '', email: '', address: '', appointmentDate: '', assignedCloserId: '', notes: '' });
            toast.success('Appointment created');
        },
        onError: () => toast.error('Failed to create appointment'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.businessName || !form.ownerName || !form.phone || !form.appointmentDate) {
            toast.error('Please fill in all required fields');
            return;
        }
        createMutation.mutate({
            ...form,
            assignedCloserId: form.assignedCloserId ? parseInt(form.assignedCloserId) : null,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[min(560px,calc(100vw-40px))]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-lg">New Appointment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Business Name *</Label>
                            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Acme Corp" required />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Owner Name *</Label>
                            <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="John Doe" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Phone Number *</Label>
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" required />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                        </div>
                    </div>
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Address</Label>
                        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Appointment Date & Time *</Label>
                            <Input type="datetime-local" value={form.appointmentDate} onChange={(e) => setForm({ ...form, appointmentDate: e.target.value })} required />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Assigned Closer</Label>
                            <select
                                value={form.assignedCloserId}
                                onChange={(e) => setForm({ ...form, assignedCloserId: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Select closer...</option>
                                {teamMembers.map((m) => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional notes..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                            Save Appointment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Deals Tab ──────────────────────────────────────────
function DealsTab({
    deals, isLoading, isAdmin, showDialog, setShowDialog,
}: {
    deals: ClosedDeal[];
    isLoading: boolean;
    isAdmin: boolean;
    showDialog: boolean;
    setShowDialog: (v: boolean) => void;
}) {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => { await api.delete(`/api/closed-deals/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['closed-deals'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            toast.success('Deal deleted');
        },
        onError: () => toast.error('Failed to delete'),
    });

    const packageColors: Record<string, string> = {
        'Starter $297': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/20',
        'Pro $597': 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-400/10 border-purple-200 dark:border-purple-400/20',
        'Full AI $997': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20',
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setShowDialog(true)}>
                    <Plus size={16} className="mr-2" />
                    Log Closed Deal
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-primary" />
                </div>
            ) : deals.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Handshake size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No closed deals yet</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {deals.map((deal) => (
                        <Card key={deal.id} className="relative group">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold text-[15px]">{deal.businessName}</h3>
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                            <User size={13} /> {deal.ownerName}
                                        </p>
                                    </div>
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => deleteMutation.mutate(deal.id)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className={cn('inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border', packageColors[deal.packageSold] || '')}>
                                        {deal.packageSold}
                                    </span>
                                    <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full border text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20">
                                        {deal.monthlyPlan}
                                    </span>
                                </div>

                                <div className="space-y-1.5 text-sm text-muted-foreground">
                                    <p className="flex items-center gap-2"><PhoneIcon size={13} /> {deal.phone}</p>
                                    {deal.email && <p className="flex items-center gap-2"><Mail size={13} /> {deal.email}</p>}
                                    {deal.address && <p className="flex items-center gap-2"><MapPin size={13} /> {deal.address}</p>}
                                    {deal.notes && (
                                        <p className="flex items-start gap-2 pt-1">
                                            <FileText size={13} className="mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{deal.notes}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                                    <span>By {deal.closerName}</span>
                                    <span>
                                        {new Date(deal.createdAt).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <DealDialog open={showDialog} onOpenChange={setShowDialog} />
        </div>
    );
}

// ─── Deal Dialog ────────────────────────────────────────
function DealDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        businessName: '', ownerName: '', phone: '', email: '', address: '',
        packageSold: '', monthlyPlan: '', notes: '',
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await api.post('/api/closed-deals', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['closed-deals'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            onOpenChange(false);
            setForm({ businessName: '', ownerName: '', phone: '', email: '', address: '', packageSold: '', monthlyPlan: '', notes: '' });
            toast.success('Deal logged successfully');
        },
        onError: () => toast.error('Failed to log deal'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.businessName || !form.ownerName || !form.phone || !form.packageSold || !form.monthlyPlan) {
            toast.error('Please fill in all required fields');
            return;
        }
        createMutation.mutate(form);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[min(560px,calc(100vw-40px))]">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-lg">Log Closed Deal</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Business Name *</Label>
                            <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Acme Corp" required />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Owner Name *</Label>
                            <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="John Doe" required />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Phone Number *</Label>
                            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" required />
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Email</Label>
                            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
                        </div>
                    </div>
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Address</Label>
                        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Package Sold *</Label>
                            <select
                                value={form.packageSold}
                                onChange={(e) => setForm({ ...form, packageSold: e.target.value })}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Select package...</option>
                                <option value="Starter $297">Starter $297</option>
                                <option value="Pro $597">Pro $597</option>
                                <option value="Full AI $997">Full AI $997</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-sm font-medium mb-1.5 block">Monthly Plan *</Label>
                            <select
                                value={form.monthlyPlan}
                                onChange={(e) => setForm({ ...form, monthlyPlan: e.target.value })}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Select plan...</option>
                                <option value="$97/mo">$97/mo</option>
                                <option value="$197/mo">$197/mo</option>
                                <option value="$397/mo">$397/mo</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <Label className="text-sm font-medium mb-1.5 block">Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Additional notes..."
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
                            Log Deal
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
