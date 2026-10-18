import { useEffect, useRef } from 'react';
import { useRouter } from '@tanstack/react-router';
import { getRouteSessionIdentity, refreshSessionRoutes } from './sessionRouteLifecycle';

export function useSessionRouteLifecycle(auth: Parameters<typeof getRouteSessionIdentity>[0] & { isLoading: boolean }) {
    const router = useRouter();
    const identity = getRouteSessionIdentity(auth);
    const previous = useRef(identity);
    useEffect(() => {
        if (auth.isLoading || identity === previous.current) return;
        previous.current = identity;
        void refreshSessionRoutes(router);
    }, [identity, auth.isLoading, router]);
}
