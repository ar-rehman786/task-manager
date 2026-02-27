'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    Clock, 
    Users, 
    Briefcase, 
    Calendar, 
    Search, 
    ArrowLeft,
    TrendingUp,
    Download
} from 'lucide-react';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { attendanceApi, AttendanceStatus } from '@/lib/api/attendance';
import Link from 'next/link';

export default function AdminAttendancePage() {
    return (
        <ProtectedRoute>
            <AdminAttendanceContent />
        </ProtectedRoute>
    );
}

function AdminAttendanceContent() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [filterUserId, setFilterUserId] = useState('all');
    const [filterClientId, setFilterClientId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showAllHistory, setShowAllHistory] = useState(false);

    // Queries
    const { data: totals } = useQuery({
        queryKey: ['admin-attendance-totals'],
        queryFn: () => attendanceApi.getAdminTotals(),
    });

    const { data: employeeTotals = [] } = useQuery({
        queryKey: ['admin-employee-totals'],
        queryFn: () => attendanceApi.getEmployeeTotals(),
    });

    const { data: clientTotals = [] } = useQuery({
        queryKey: ['admin-client-totals'],
        queryFn: () => attendanceApi.getClientTotals(),
    });

    const { data: history = [] } = useQuery({
        queryKey: ['admin-attendance-history', showAllHistory, filterUserId, filterClientId, startDate, endDate, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (showAllHistory) params.append('all', 'true');
            if (filterUserId !== 'all') params.append('userId', filterUserId);
            if (filterClientId !== 'all') params.append('clientId', filterClientId);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            if (search) params.append('search', search);
            
            const response = await api.get<AttendanceStatus[]>(`/api/attendance/admin/history?${params.toString()}`);
            return response.data;
        },
    });

    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const response = await api.get<any[]>('/api/team');
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

    const formatHours = (hours: any) => {
        const h = parseFloat(hours || 0);
        return h.toFixed(2);
    };

    const formatDuration = (minutes: number) => {
        if (!minutes) return '0m';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const safeFormatTime = (dateStr: string | undefined | null) => {
        if (!dateStr) return '--:--';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const safeFormatDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return 'No Date';
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    };

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/attendance">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Attendance Dashboard</h1>
                        <p className="text-muted-foreground">Comprehensive tracking and reporting for all employees.</p>
                    </div>
                </div>
                <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Hours Today</p>
                            <h3 className="text-3xl font-bold mt-1">{totals?.today || '0.00'}h</h3>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Clock className="h-6 w-6" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">This Week</p>
                            <h3 className="text-3xl font-bold mt-1">{totals?.week || '0.00'}h</h3>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full text-green-600">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6 border-l-4 border-l-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">This Month</p>
                            <h3 className="text-3xl font-bold mt-1">{totals?.month || '0.00'}h</h3>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                            <Calendar className="h-6 w-6" />
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Reports Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="p-4">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Users className="h-4 w-4" /> Employee Totals
                        </h3>
                        <div className="space-y-4">
                            {employeeTotals.length === 0 && <p className="text-xs text-muted-foreground">No data this month.</p>}
                            {employeeTotals.map((e: any) => (
                                <div key={e.userName} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium">{e.userName}</span>
                                        <span className="text-muted-foreground">{formatHours(e.monthHours)}h</span>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div 
                                            className="bg-primary h-full rounded-full transition-all" 
                                            style={{ width: `${Math.min(100, (parseFloat(e.monthHours) / 160) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">This Week: {formatHours(e.weekHours)}h</div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4">
                        <h3 className="font-bold flex items-center gap-2 mb-4">
                            <Briefcase className="h-4 w-4" /> Client Totals
                        </h3>
                        <div className="space-y-4 text-sm">
                            {clientTotals.length === 0 && <p className="text-xs text-muted-foreground">No data this month.</p>}
                            {clientTotals.map((c: any) => (
                                <div key={c.clientName} className="flex flex-col border-b border-muted/50 pb-2 last:border-0">
                                    <span className="font-semibold">{c.clientName}</span>
                                    <div className="flex justify-between mt-1 text-xs">
                                        <span className="text-muted-foreground">Week: {formatHours(c.weekHours)}h</span>
                                        <span className="font-medium text-primary">Month: {formatHours(c.monthHours)}h</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Main Table Area */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Filters */}
                    <Card className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs">Employee</Label>
                                <Select value={filterUserId} onValueChange={setFilterUserId}>
                                    <SelectTrigger size="sm">
                                        <SelectValue placeholder="All Members" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Members</SelectItem>
                                        {users.map((u: any) => (
                                            <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Client</Label>
                                <Select value={filterClientId} onValueChange={setFilterClientId}>
                                    <SelectTrigger size="sm">
                                        <SelectValue placeholder="All Clients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Clients</SelectItem>
                                        {clients.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Start Date</Label>
                                <Input 
                                    type="date" 
                                    size="sm" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)} 
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">End Date</Label>
                                <Input 
                                    type="date" 
                                    size="sm" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="mt-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by name or client..." 
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </Card>

                    {/* Records Table */}
                    <Card className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50 border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4">Employee</th>
                                        <th className="text-left py-3 px-4">Client</th>
                                        <th className="text-left py-3 px-4">Clock In</th>
                                        <th className="text-left py-3 px-4">Clock Out</th>
                                        <th className="text-left py-3 px-4">Duration</th>
                                        <th className="text-left py-3 px-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-muted-foreground">No attendance records match your filters.</td>
                                        </tr>
                                    ) : (
                                        history.map((record) => (
                                            <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold">{record.userName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{record.userEmail}</div>
                                                </td>
                                                <td className="py-3 px-4 font-medium">{record.clientName || 'N/A'}</td>
                                                <td className="py-3 px-4">
                                                    <div>{safeFormatDate(record.clockInTime)}</div>
                                                    <div className="text-[10px] text-muted-foreground">{safeFormatTime(record.clockInTime)}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {record.clockOutTime ? (
                                                        <>
                                                            <div>{safeFormatDate(record.clockOutTime)}</div>
                                                            <div className="text-[10px] text-muted-foreground">{safeFormatTime(record.clockOutTime)}</div>
                                                        </>
                                                    ) : '--'}
                                                </td>
                                                <td className="py-3 px-4 font-bold">
                                                    {record.workDuration ? formatDuration(record.workDuration) : 'Active'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {record.status === 'active' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                            Closed
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {history.length >= 5 && !showAllHistory && (
                            <div className="p-4 bg-muted/20 text-center border-t">
                                <Button 
                                    variant="link" 
                                    onClick={() => setShowAllHistory(true)}
                                    className="text-primary font-bold"
                                >
                                    Show More Records ↓
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
