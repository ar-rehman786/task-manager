'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/authStore';

interface AttendanceSession {
    id: number;
    userId: number;
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
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock every second
    useEffect(() => {
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

    const { data: history = [] } = useQuery({
        queryKey: ['attendance-history'],
        queryFn: async () => {
            const response = await api.get<AttendanceSession[]>('/api/attendance/history?limit=30');
            return response.data;
        },
    });

    // Clock in/out mutations
    const clockInMutation = useMutation({
        mutationFn: async (notes?: string) => {
            const response = await api.post('/api/attendance/clock-in', { notes });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
            queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
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

    const isClockedIn = activeSession && activeSession.status === 'active';

    const calculateDuration = (start: string) => {
        const startTime = new Date(start);
        const diff = currentTime.getTime() - startTime.getTime();
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

    if (isLoading) {
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
                                Started at {new Date(activeSession.clockInTime).toLocaleTimeString()}
                            </div>
                        </div>
                    )}

                    {/* Action Button */}
                    <Button
                        size="lg"
                        variant={isClockedIn ? 'destructive' : 'default'}
                        onClick={() => {
                            if (isClockedIn) {
                                clockOutMutation.mutate();
                            } else {
                                clockInMutation.mutate();
                            }
                        }}
                        disabled={clockInMutation.isPending || clockOutMutation.isPending}
                        className="px-12"
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
                                ? new Date(activeSession.clockInTime).toLocaleTimeString()
                                : '--:--'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-sm text-muted-foreground">Total Duration</div>
                        <div className="text-xl font-semibold">
                            {formatDuration(
                                history
                                    .filter(
                                        (r) =>
                                            new Date(r.clockInTime).toDateString() === new Date().toDateString()
                                    )
                                    .reduce((sum, r) => sum + (r.workDuration || 0), 0)
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* History */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Attendance History (Last 30 Days)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-3 px-4">Date</th>
                                <th className="text-left py-3 px-4">Clock In</th>
                                <th className="text-left py-3 px-4">Clock Out</th>
                                <th className="text-left py-3 px-4">Duration</th>
                                <th className="text-left py-3 px-4">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((record) => (
                                <tr key={record.id} className="border-b hover:bg-muted/50">
                                    <td className="py-3 px-4">
                                        {new Date(record.clockInTime).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-4">
                                        {new Date(record.clockInTime).toLocaleTimeString()}
                                    </td>
                                    <td className="py-3 px-4">
                                        {record.clockOutTime
                                            ? new Date(record.clockOutTime).toLocaleTimeString()
                                            : '--:--'}
                                    </td>
                                    <td className="py-3 px-4 font-semibold">
                                        {record.workDuration ? formatDuration(record.workDuration) : 'Active'}
                                    </td>
                                    <td className="py-3 px-4">
                                        {record.status === 'active' ? (
                                            <span className="text-green-600">🟢 Active</span>
                                        ) : (
                                            <span className="text-gray-600">Completed</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
