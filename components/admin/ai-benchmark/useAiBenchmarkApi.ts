import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { dbGetAccessToken, ensureDbSession } from '../../../services/dbService';
import { requestBenchmarkApi, type FetchBenchmarkApi } from './aiBenchmarkApi';

/**
 * The admin's Supabase access token and a fetcher for the internal benchmark
 * API that carries it. The token is null until the session is ready, and again
 * after signing out.
 */
export const useAiBenchmarkApi = () => {
    const { isAuthenticated } = useAuth();
    const [accessToken, setAccessToken] = useState<string | null>(null);

    // Reads the token from the Supabase client (an external session store).
    useEffect(() => {
        if (!isAuthenticated) {
            setAccessToken(null);
            return;
        }
        let cancelled = false;

        const bootstrapAuth = async () => {
            await ensureDbSession();
            const token = await dbGetAccessToken();
            if (!cancelled) {
                setAccessToken(token);
            }
        };

        void bootstrapAuth();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    const fetchBenchmarkApi = useCallback<FetchBenchmarkApi>(
        (path, init) => requestBenchmarkApi(accessToken, path, init),
        [accessToken],
    );

    return { isAuthenticated, accessToken, fetchBenchmarkApi };
};

export type AiBenchmarkApi = ReturnType<typeof useAiBenchmarkApi>;
