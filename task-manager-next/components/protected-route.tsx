'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isAuthenticated, _hasHydrated } = useAuthStore();

    useEffect(() => {
        if (_hasHydrated && !isAuthenticated) {
            router.push('/login');
        }
    }, [_hasHydrated, isAuthenticated, router]);

    // Show nothing while hydrating to prevent flickering or premature redirects
    if (!_hasHydrated) {
        return null;
    }

    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
