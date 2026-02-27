'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { attendanceApi } from '@/lib/api/attendance';
import { useAuthStore } from '@/lib/store/authStore';
import { Clock, Briefcase, Users, Calendar, Timer, Play, Square, Activity, ExternalLink } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AttendanceSession {
    id: number;
    userId: number;
    userName?: string;
    clientId?: number;
    clientName?: string;
    clockInTime: string;
    clockOutTime?: string;
    workDuration?: number;
    status: 'active' | 'completed';
    notes?: string;
}

export default function AttendancePage() {
    return (
        <ProtectedRoute>
            <AttendanceContent />
        </ProtectedRoute>
    );
}

function AttendanceContent() {
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [showAllHistory, setShowAllHistory] = useState(false);

    // Update clock every second
    useEffect(() => {
        setMounted(true);
        setCurrentTime(new Date());
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Fetch attendance status
    const { data: activeSession, isLoading } = useQuery({
        queryKey: ['attendance-status'],
        queryFn: async () => {
            const response = await api.get<AttendanceSession>('/api/attendance/status');
            return response.data;
        },
    });

    const { data: projects = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const response = await api.get<any[]>('/api/projects');
            return response.data;
        },
    });

    const { data: history = [] } = useQuery({
        queryKey: ['attendance-history', showAllHistory],
        queryFn: () => attendanceApi.getHistory(showAllHistory),
    });

    // Clock in/out mutations
    const clockInMutation = useMutation({
        mutationFn: async ({ clientId, notes }: { clientId: number, notes?: string }) => {
            return attendanceApi.clockIn({ clientId, notes });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
            setSelectedClientId('');
            toast.success('Session Initiated', { description: 'Good luck with your shift!' });
        },
    });

    const clockOutMutation = useMutation({
        mutationFn: async (notes?: string) => {
            const response = await api.post('/api/attendance/clock-out', { notes });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
            toast.success('Session Terminated', { description: 'Records have been archived.' });
        },
    });

    const isClockedIn = activeSession && activeSession.status === 'active';

    const safeFormatTime = (dateStr: string | undefined | null) => {
        if (!dateStr) return '--:--';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Time';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const safeFormatDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return 'No Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    };

    const calculateDuration = (start: string) => {
        const startTime = new Date(start);
        if (isNaN(startTime.getTime()) || !currentTime) return '00:00:00';
        const diff = Math.max(0, currentTime.getTime() - startTime.getTime());
        const hours = Math.floor(diff / 1000 / 60 / 60);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const formatDuration = (minutes: number) => {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const currentShiftDuration = useMemo(() => {
        return formatDuration(
            history
                .filter((r) => {
                    const getShiftDate = (d: string) => {
                        const date = new Date(d);
                        // 12:00 PM boundary for graveyard shift
                        if (date.getHours() < 12) date.setDate(date.getDate() - 1);
                        return date.toDateString();
                    };
                    return getShiftDate(r.clockInTime) === getShiftDate(new Date().toISOString());
                })
                .reduce((sum, r) => sum + (r.workDuration || 0), 0)
        );
    }, [history]);

    if (isLoading || !mounted || !currentTime) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
                    <p className="text-muted-foreground text-sm mt-1">Track your work hours and project activities.</p>
                </div>
                <div className="hidden sm:flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border text-[13px] font-medium">
                    <Calendar className="w-4 h-4 text-primary" />
                    {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Clock Card */}
                <Card className="lg:col-span-8 overflow-hidden border shadow-sm">
                    <div className="p-8 h-full flex flex-col items-center justify-center space-y-8 relative">
                        {/* Status Chip */}
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest relative z-10",
                            isClockedIn ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-muted border-muted-foreground/20 text-muted-foreground"
                        )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", isClockedIn ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40")} />
                            {isClockedIn ? 'System Active' : 'System Offline'}
                        </div>

                        {/* Current Time Display */}
                        <div className="text-center space-y-1 relative z-10">
                            <div className="text-4xl font-bold tracking-tighter tabular-nums text-foreground">
                                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground/60 uppercase tracking-widest">Global Timestamp</div>
                        </div>

                        {/* Counter Section */}
                        {isClockedIn && activeSession && (
                            <div className="w-full max-w-md bg-muted/20 backdrop-blur-sm border rounded-2xl p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            <Timer className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Elapsed</div>
                                            <div className="text-2xl font-bold tabular-nums text-primary leading-tight">
                                                {calculateDuration(activeSession.clockInTime)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pulse Start</div>
                                        <div className="text-sm font-bold">{safeFormatTime(activeSession.clockInTime)}</div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-muted-foreground/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Engagement</span>
                                    </div>
                                    <div className="text-lg font-bold text-foreground flex items-center gap-2">
                                        {activeSession.clientName || 'Optimizing...'}
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Client Selector (Pre-Clock In) */}
                        {!isClockedIn && (
                            <div className="w-full max-w-sm space-y-3 relative z-10">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 ml-1">
                                    <Briefcase className="w-3 h-3" />
                                    Select Project Parameter
                                </Label>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger className="h-11 border hover:border-primary/40 transition-colors bg-background/50 backdrop-blur-sm shadow-sm">
                                        <SelectValue placeholder="Which project are you initiating?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id.toString()} className="h-10">
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="pt-4 w-full max-w-xs relative z-10">
                            <Button
                                size="sm"
                                variant={isClockedIn ? 'destructive' : 'default'}
                                onClick={() => {
                                    if (isClockedIn) {
                                        clockOutMutation.mutate(undefined);
                                    } else {
                                        if (!selectedClientId) {
                                            toast.error('Initialization Failed', { description: 'Select parameter.' });
                                            return;
                                        }
                                        clockInMutation.mutate({ clientId: parseInt(selectedClientId) });
                                    }
                                }}
                                disabled={clockInMutation.isPending || clockOutMutation.isPending || (!isClockedIn && !selectedClientId)}
                                className={cn(
                                    "w-full h-10 text-xs font-bold uppercase tracking-widest transition-all duration-300 shadow-sm",
                                    isClockedIn 
                                        ? "bg-red-500 hover:bg-red-600 shadow-red-500/10" 
                                        : "bg-primary hover:bg-primary/90 shadow-primary/10"
                                )}
                            >
                                {clockInMutation.isPending || clockOutMutation.isPending ? (
                                    <span className="flex items-center gap-2">
                                        <Activity className="w-4 h-4 animate-pulse" />
                                        Processing...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        {isClockedIn ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                                        {isClockedIn ? 'Clock Out' : 'Clock In'}
                                    </span>
                                )}
                            </Button>
                            {!isClockedIn && (
                                <p className="text-[10px] text-center text-muted-foreground mt-3 font-semibold uppercase tracking-widest opacity-60">Shift: 19:00 - 04:00</p>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Summary Column */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="p-5 border-2 shadow-sm bg-muted/10">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Session Overview
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-background border rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", isClockedIn ? "bg-emerald-500/10" : "bg-muted")}>
                                        <Users className={cn("w-4 h-4", isClockedIn ? "text-emerald-500" : "text-muted-foreground")} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Status</div>
                                        <div className="text-sm font-bold mt-1">
                                            {isClockedIn ? 'Active Now' : 'Disconnected'}
                                        </div>
                                    </div>
                                </div>
                                {isClockedIn && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                            </div>

                            <div className="flex items-center justify-between p-3 bg-background border rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Start Vector</div>
                                        <div className="text-sm font-bold mt-1">
                                            {activeSession ? safeFormatTime(activeSession.clockInTime) : '--:--'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-background border rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Timer className="w-4 h-4 text-purple-500" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Shift Aggregate</div>
                                        <div className="text-sm font-bold mt-1">
                                            {currentShiftDuration}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {user?.role === 'admin' && (
                        <Card className="p-5 border-2 border-primary/20 bg-primary/5 shadow-sm group cursor-pointer hover:bg-primary/10 transition-colors overflow-hidden relative">
                            <div className="absolute -right-4 -bottom-4 opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
                                <Users className="w-32 h-32 text-primary" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Administrative Control</h3>
                                <p className="text-[11px] text-muted-foreground mb-4 line-clamp-2">Access master logs, verify team presence, and oversee production metrics.</p>
                                <Button asChild size="sm" variant="default" className="w-full text-[11px] font-bold uppercase tracking-tighter">
                                    <a href="/attendance/admin">
                                        Elevated Dashboard
                                        <ExternalLink className="w-3 h-3 ml-2" />
                                    </a>
                                </Button>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* History Table */}
            <Card className="border shadow-sm overflow-hidden">
                <div className="p-5 border-b bg-muted/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Calendar className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold">Attendance Record Log</h3>
                            <p className="text-[11px] text-muted-foreground font-medium">Verified historical work coordinates.</p>
                        </div>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/30">
                            <tr className="border-b">
                                <th className="text-left font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Entry Date</th>
                                <th className="text-left font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Project</th>
                                <th className="text-center font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Clock In</th>
                                <th className="text-center font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Clock Out</th>
                                <th className="text-center font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Net Duration</th>
                                <th className="text-right font-bold uppercase tracking-widest text-[10px] text-muted-foreground py-4 px-6">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-muted-foreground italic font-medium">No archived records detected in system.</td>
                                </tr>
                            ) : (
                                history.map((record) => (
                                    <tr key={record.id} className="hover:bg-muted/20 transition-colors group">
                                        <td className="py-4 px-6 font-semibold whitespace-nowrap">
                                            {safeFormatDate(record.clockInTime)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                                                <Briefcase className="w-3.5 h-3.5 text-primary/60" />
                                                {record.clientName || 'Unspecified'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center tabular-nums">
                                            {safeFormatTime(record.clockInTime)}
                                        </td>
                                        <td className="py-4 px-6 text-center tabular-nums">
                                            {record.clockOutTime ? safeFormatTime(record.clockOutTime) : '--:--'}
                                        </td>
                                        <td className="py-4 px-6 text-center font-bold text-primary tabular-nums">
                                            {record.workDuration ? formatDuration(record.workDuration) : 'Calculating...'}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                record.status === 'active' 
                                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" 
                                                    : "bg-blue-500/10 border-blue-500/20 text-blue-600"
                                            )}>
                                                <Activity className={cn("w-3 h-3", record.status === 'active' && "animate-pulse")} />
                                                {record.status === 'active' ? 'Live' : 'Archived'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {history.length >= 5 && !showAllHistory && (
                    <div className="p-4 bg-muted/5 border-t">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            className="w-full text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => setShowAllHistory(true)}
                        >
                            Retrieve Extended Archives
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
