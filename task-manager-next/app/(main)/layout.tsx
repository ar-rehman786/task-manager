import ProtectedRoute from '@/components/protected-route';
import Sidebar from '@/components/layout/sidebar';
import Topbar from '@/components/layout/topbar';
import { GlobalStickies } from '@/components/ideation/global-stickies';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedRoute>
            <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <Topbar />
                    <main className="flex-1 overflow-y-auto bg-background p-6">
                        {children}
                    </main>
                    <GlobalStickies />
                </div>
            </div>
        </ProtectedRoute>
    );
}
