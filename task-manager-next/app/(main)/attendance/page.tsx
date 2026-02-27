'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { attendanceApi } from '@/lib/api/attendance';
import { useAuthStore } from '@/lib/store/authStore';
import { Pencil, Clock, Briefcase, Users, Calendar } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    const [editingRecord, setEditingRecord] = useState<AttendanceSession | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [historyLimit, setHistoryLimit] = useState(5);
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

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const response = await api.get<any[]>('/api/clients');
            return response.data;
        },
    });

    const { data: history = [] } = useQuery({
        queryKey: ['attendance-history', showAllHistory],
        queryFn: () => attendanceApi.getHistory(showAllHistory),
    });

    const { data: adminHistory = [] } = useQuery({
        queryKey: ['attendance-admin-history'],
        queryFn: async () => {
            const response = await api.get<AttendanceSession[]>('/api/attendance/admin/history?limit=50');
            return response.data;
        },
        enabled: user?.role === 'admin'
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
        },
    });

    const updateRecordMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            return attendanceApi.updateRecord(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-admin-history'] });
            setEditingRecord(null);
        },
    });

    const isClockedIn = activeSession && activeSession.status === 'active';

    const safeFormatTime = (dateStr: string | undefined | null) => {
        if (!dateStr) return '--:--';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Time';
        return date.toLocaleTimeString();
    };

    const safeFormatDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return 'No Date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString();
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
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold">Attendance</h1>

            {/* Clock In/Out Widget */}
            <Card className="p-8">
                <div className="flex flex-col items-center space-y-6">
                    {/* Status Indicator */}
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-3 h-3 rounded-full ${isClockedIn ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                }`}
                        />
                        <span className="font-semibold">
                            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
                        </span>
                    </div>

                    {/* Current Time */}
                    <div className="text-4xl font-bold">{currentTime.toLocaleTimeString()}</div>

                    {/* Duration */}
                    {isClockedIn && activeSession && (
                        <div className="text-center">
                            <div className="text-sm text-muted-foreground">Work Duration</div>
                            <div className="text-3xl font-bold text-primary">
                                {calculateDuration(activeSession.clockInTime)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Started at {safeFormatTime(activeSession.clockInTime)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Shift: 7 PM - 4 AM
                            </div>
                        </div>
                    )}

                    {/* Client Selection */}
                    {!isClockedIn && (
                        <div className="w-full max-w-xs space-y-2">
                            <Label>Select Client/Project (Required)</Label>
                            <Select
                                value={selectedClientId}
                                onValueChange={setSelectedClientId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Which client are you working for?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id.toString()}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {isClockedIn && activeSession && (
                        <div className="text-center bg-muted/30 p-4 rounded-lg w-full max-w-xs">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Active Project</div>
                            <div className="text-lg font-bold text-primary">{activeSession.clientName || 'Loading...'}</div>
                        </div>
                    )}

                    {/* Action Button */}
                    <Button
                        size="lg"
                        variant={isClockedIn ? 'destructive' : 'default'}
                        onClick={() => {
                            if (isClockedIn) {
                                clockOutMutation.mutate(undefined);
                            } else {
                                if (!selectedClientId) {
                                    alert('Please select a client first');
                                    return;
                                }
                                clockInMutation.mutate({ clientId: parseInt(selectedClientId) });
                            }
                        }}
                        disabled={clockInMutation.isPending || clockOutMutation.isPending || (!isClockedIn && !selectedClientId)}
                        className="px-12 h-16 text-lg font-bold"
                    >
                        {isClockedIn ? '⏱️ Clock Out' : '▶️ Clock In'}
                    </Button>
                </div>
            </Card>

            {/* Today's Summary */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Today's Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className="text-xl font-semibold">
                            {isClockedIn ? '🟢 Working' : '⚪ Not Working'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground">Clock In</div>
                        <div className="text-xl font-semibold">
                            {activeSession
                                ? safeFormatTime(activeSession.clockInTime)
                                : '--:--'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground">Current Shift Duration</div>
                        <div className="text-xl font-semibold">
                            {currentShiftDuration}
                        </div>
                    </div>
                </div>
            </Card>

            {/* User History */}
            <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">My Attendance History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Client</th>
                                <th className="text-left py-3 px-4">Clock In</th>
                                <th className="text-left py-3 px-4">Clock Out</th>
                                <th className="text-left py-3 px-4">Duration</th>
                                <th className="text-left py-3 px-4">Status</th>
                                <th className="text-right py-3 px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-muted-foreground">No records found.</td>
                                </tr>
                            ) : (
                                history.map((record) => (
                                    <tr key={record.id} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4">
                                            {safeFormatDate(record.clockInTime)}
                                        </td>
                                        <td className="py-3 px-4 font-medium">
                                            {record.clientName || 'N/A'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {safeFormatTime(record.clockInTime)}
                                        </td>
                                        <td className="py-3 px-4">
                                            {record.clockOutTime
                                                ? safeFormatTime(record.clockOutTime)
                                                : '--:--'}
                                        </td>
                                        <td className="py-3 px-4 font-semibold">
                                            {record.workDuration ? formatDuration(record.workDuration) : 'Active'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {record.status === 'active' ? (
                                                <span className="text-green-600 font-bold">🟢 Active</span>
                                            ) : (
                                                <span className="text-gray-600">Completed</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingRecord(record)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {history.length >= 5 && !showAllHistory && (
                    <div className="mt-4 text-center">
                        <Button 
                            variant="outline" 
                            onClick={() => setShowAllHistory(true)}
                        >
                            Show More Records
                        </Button>
                    </div>
                )}
            </Card>

            {/* Admin Dashboard Link if admin */}
            {user?.role === 'admin' && (
                <div className="flex justify-center pt-4">
                    <Button asChild size="lg" className="px-8 py-6 text-lg">
                        <a href="/attendance/admin">Go to Admin Attendance Dashboard →</a>
                    </Button>
                </div>
            )}

            {editingRecord && (
                <EditAttendanceModal
                    record={editingRecord}
                    onClose={() => setEditingRecord(null)}
                    onSave={(data) => updateRecordMutation.mutate({ id: editingRecord.id, data })}
                    isPending={updateRecordMutation.isPending}
                />
            )}
        </div>
    );
}

function EditAttendanceModal({
    record,
    onClose,
    onSave,
    isPending
}: {
    record: AttendanceSession;
    onClose: () => void;
    onSave: (data: any) => void;
    isPending: boolean;
}) {
    // Convert UTC to local datetime-local format (YYYY-MM-DDTHH:mm)
    const toLocalISO = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const [clockInTime, setClockInTime] = useState(toLocalISO(record.clockInTime));
    const [clockOutTime, setClockOutTime] = useState(toLocalISO(record.clockOutTime));
    const [notes, setNotes] = useState(record.notes || '');

    const handleSave = () => {
        // Convert local back to UTC
        const data = {
            clockInTime: clockInTime ? new Date(clockInTime).toISOString() : undefined,
            clockOutTime: clockOutTime ? new Date(clockOutTime).toISOString() : null,
            notes
        };
        onSave(data);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-width-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Attendance</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="clock-in" className="text-right">Clock In</Label>
                        <Input
                            id="clock-in"
                            type="datetime-local"
                            value={clockInTime}
                            onChange={(e) => setClockInTime(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="clock-out" className="text-right">Clock Out</Label>
                        <Input
                            id="clock-out"
                            type="datetime-local"
                            value={clockOutTime}
                            onChange={(e) => setClockOutTime(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes" className="text-right">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="col-span-3"
                            placeholder="Add notes..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isPending}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isPending}>
                        {isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
