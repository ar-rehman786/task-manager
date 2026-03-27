'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProtectedRoute from '@/components/protected-route';
import api from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/authStore';
import { Phone, Calendar, Send, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DailyReport {
    id: number;
    userId: number;
    userName: string;
    reportDate: string;
    callsMade: number;
    createdAt: string;
}

export default function DailyReportsPage() {
    return (
        <ProtectedRoute>
            <DailyReportsContent />
        </ProtectedRoute>
    );
}

function DailyReportsContent() {
    const queryClient = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const isAdmin = user?.role === 'admin';

    const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [callsMade, setCallsMade] = useState('');

    const { data: reports = [], isLoading } = useQuery({
        queryKey: ['daily-reports'],
        queryFn: async () => {
            const response = await api.get<DailyReport[]>('/api/daily-reports');
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: { reportDate: string; callsMade: number }) => {
            const response = await api.post('/api/daily-reports', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            setCallsMade('');
            toast.success('Report submitted successfully');
        },
        onError: () => toast.error('Failed to submit report'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/api/daily-reports/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
            queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
            toast.success('Report deleted');
        },
        onError: () => toast.error('Failed to delete report'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reportDate || !callsMade) {
            toast.error('Please fill in all fields');
            return;
        }
        createMutation.mutate({ reportDate, callsMade: parseInt(callsMade) });
    };

    return (
        <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Daily Call Reports</h1>
                <p className="text-sm text-muted-foreground mt-1">Submit and track your daily call activity</p>
            </div>

            {/* Submit Form */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Phone size={16} className="text-primary" />
                        Submit Daily Report
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-4">
                        <div className="flex-1 w-full">
                            <Label htmlFor="reportDate" className="text-sm font-medium mb-1.5 block">Date</Label>
                            <Input
                                id="reportDate"
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <Label htmlFor="callsMade" className="text-sm font-medium mb-1.5 block">Calls Made</Label>
                            <Input
                                id="callsMade"
                                type="number"
                                min="0"
                                placeholder="e.g. 45"
                                value={callsMade}
                                onChange={(e) => setCallsMade(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                            {createMutation.isPending ? (
                                <Loader2 size={16} className="animate-spin mr-2" />
                            ) : (
                                <Send size={16} className="mr-2" />
                            )}
                            Submit Daily Report
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Reports Table */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar size={16} className="text-primary" />
                        {isAdmin ? 'All Daily Reports' : 'Your Daily Reports'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={24} className="animate-spin text-primary" />
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Phone size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No reports submitted yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
                                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Calls Made</th>
                                        {isAdmin && <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Submitted By</th>}
                                        {isAdmin && <th className="text-right py-3 px-4 font-semibold text-muted-foreground">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((report) => (
                                        <tr key={report.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                                            <td className="py-3 px-4">
                                                {new Date(report.reportDate).toLocaleDateString('en-US', {
                                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/20">
                                                    {report.callsMade} calls
                                                </span>
                                            </td>
                                            {isAdmin && <td className="py-3 px-4 text-muted-foreground">{report.userName}</td>}
                                            {isAdmin && (
                                                <td className="py-3 px-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => deleteMutation.mutate(report.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
