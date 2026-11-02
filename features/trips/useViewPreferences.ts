import { useCallback, useEffect, useRef } from 'react';
import type { IViewSettings } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { DB_ENABLED } from '../../config/db';
import { dbUpsertUserSettings } from '../../services/dbApi';
import { normalizeSettingsForPersistence } from './tripSessionModel';

/** Account-owned, debounced preferences. Route unmounts and auth changes cancel pending work. */
export const useViewPreferences = () => {
    const { isAuthenticated, access } = useAuth();
    const accountId = DB_ENABLED && isAuthenticated && access?.isAnonymous !== true
        ? access?.userId ?? null
        : null;
    const saveRef = useRef<{
        accountId: string | null;
        timer: ReturnType<typeof setTimeout> | null;
        pendingKey: string | null;
        persistedKey: string | null;
    }>({ accountId, timer: null, pendingKey: null, persistedKey: null });

    useEffect(() => {
        const state = { accountId, timer: null, pendingKey: null, persistedKey: null } as typeof saveRef.current;
        saveRef.current = state;
        return () => {
            if (state.timer) clearTimeout(state.timer);
            // In-flight results also lose ownership when this account leaves.
            if (saveRef.current === state) saveRef.current = { ...state, accountId: null };
        };
    }, [accountId]);

    return useCallback((settings: IViewSettings) => {
        const state = saveRef.current;
        if (!accountId || state.accountId !== accountId) return;
        const normalized = normalizeSettingsForPersistence(settings);
        const payloadKey = JSON.stringify(normalized);
        if (payloadKey === state.pendingKey || payloadKey === state.persistedKey) return;
        if (state.timer) clearTimeout(state.timer);
        state.pendingKey = payloadKey;
        state.timer = setTimeout(() => {
            state.timer = null;
            if (saveRef.current !== state) return;
            void dbUpsertUserSettings(normalized).then(() => {
                if (saveRef.current === state) state.persistedKey = payloadKey;
            }).catch(() => {
                // Keep the current view locally and let a later interaction retry.
            }).finally(() => {
                if (state.pendingKey === payloadKey) state.pendingKey = null;
            });
        }, 800);
    }, [accountId]);
};
