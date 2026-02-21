import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { DB_ENABLED } from '../../config/db';
import {
    dbRevokeTripShares,
    dbSetTripSharingEnabled,
    ensureDbSession,
} from '../../services/dbApi';
import type { ShareMode } from '../../types';

const SHARE_LINK_STORAGE_PREFIX = 'tf_share_links:';

const getShareLinksStorageKey = (tripId: string) => `${SHARE_LINK_STORAGE_PREFIX}${tripId}`;

const readStoredShareLinks = (tripId: string): Partial<Record<ShareMode, string>> => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(getShareLinksStorageKey(tripId));
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const links: Partial<Record<ShareMode, string>> = {};
        if (typeof parsed.view === 'string' && parsed.view.trim().length > 0) links.view = parsed.view;
        if (typeof parsed.edit === 'string' && parsed.edit.trim().length > 0) links.edit = parsed.edit;
        return links;
    } catch {
        return {};
    }
};

const clearStoredShareLinks = (tripId: string) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(getShareLinksStorageKey(tripId));
    } catch {
        // ignore storage issues
    }
};

interface UseTripShareLifecycleOptions {
    tripId: string;
    canShare: boolean;
    isTripLockedByExpiry: boolean;
}

interface UseTripShareLifecycleResult {
    isShareOpen: boolean;
    setIsShareOpen: Dispatch<SetStateAction<boolean>>;
    shareMode: ShareMode;
    setShareMode: Dispatch<SetStateAction<ShareMode>>;
    shareUrlsByMode: Partial<Record<ShareMode, string>>;
    setShareUrlsByMode: Dispatch<SetStateAction<Partial<Record<ShareMode, string>>>>;
    isGeneratingShare: boolean;
    setIsGeneratingShare: Dispatch<SetStateAction<boolean>>;
}

export const useTripShareLifecycle = ({
    tripId,
    canShare,
    isTripLockedByExpiry,
}: UseTripShareLifecycleOptions): UseTripShareLifecycleResult => {
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [shareMode, setShareMode] = useState<ShareMode>('view');
    const [shareUrlsByMode, setShareUrlsByMode] = useState<Partial<Record<ShareMode, string>>>(
        () => readStoredShareLinks(tripId)
    );
    const [isGeneratingShare, setIsGeneratingShare] = useState(false);
    const lastSyncedSharingLockRef = useRef<boolean | null>(null);

    useEffect(() => {
        setShareUrlsByMode(readStoredShareLinks(tripId));
    }, [tripId]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(getShareLinksStorageKey(tripId), JSON.stringify(shareUrlsByMode));
        } catch {
            // ignore storage issues
        }
    }, [tripId, shareUrlsByMode]);

    useEffect(() => {
        lastSyncedSharingLockRef.current = null;
    }, [tripId]);

    useEffect(() => {
        if (!canShare) return;
        if (!DB_ENABLED) {
            if (isTripLockedByExpiry) {
                setIsShareOpen(false);
                setShareUrlsByMode({});
                clearStoredShareLinks(tripId);
            }
            return;
        }

        if (lastSyncedSharingLockRef.current === isTripLockedByExpiry) return;
        lastSyncedSharingLockRef.current = isTripLockedByExpiry;

        let canceled = false;
        void (async () => {
            await ensureDbSession();
            if (canceled) return;

            await dbSetTripSharingEnabled(tripId, !isTripLockedByExpiry);
            if (canceled) return;

            if (isTripLockedByExpiry) {
                setIsShareOpen(false);
                setShareUrlsByMode({});
                clearStoredShareLinks(tripId);
                await dbRevokeTripShares(tripId);
            }
        })();

        return () => {
            canceled = true;
        };
    }, [canShare, isTripLockedByExpiry, tripId]);

    return {
        isShareOpen,
        setIsShareOpen,
        shareMode,
        setShareMode,
        shareUrlsByMode,
        setShareUrlsByMode,
        isGeneratingShare,
        setIsGeneratingShare,
    };
};
