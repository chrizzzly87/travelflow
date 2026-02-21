import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { DB_ENABLED } from '../../config/db';
import {
    dbCreateShareLink,
    dbGetTrip,
    dbListTripShares,
    dbUpsertTrip,
    ensureDbSession,
} from '../../services/dbApi';
import { ITrip, IViewSettings, ShareMode } from '../../types';
import { buildShareUrl } from '../../utils';

type ShareToastTone = 'add' | 'info' | 'neutral' | 'remove';

interface UseTripShareActionsParams {
    canShare: boolean;
    isTripLockedByExpiry: boolean;
    tripId: string;
    trip: ITrip;
    currentViewSettings: IViewSettings;
    shareMode: ShareMode;
    shareUrlsByMode: Partial<Record<ShareMode, string>>;
    setShareUrlsByMode: Dispatch<SetStateAction<Partial<Record<ShareMode, string>>>>;
    setIsShareOpen: (isOpen: boolean) => void;
    setIsGeneratingShare: (isLoading: boolean) => void;
    showToast: (message: string, options?: { tone?: ShareToastTone; title?: string }) => void;
}

const copyToClipboard = async (value: string): Promise<void> => {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const input = document.createElement('input');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
};

export const useTripShareActions = ({
    canShare,
    isTripLockedByExpiry,
    tripId,
    trip,
    currentViewSettings,
    shareMode,
    shareUrlsByMode,
    setShareUrlsByMode,
    setIsShareOpen,
    setIsGeneratingShare,
    showToast,
}: UseTripShareActionsParams) => {
    const activeShareUrl = shareUrlsByMode[shareMode] ?? null;

    const handleShare = useCallback(async () => {
        if (!canShare) return;
        if (isTripLockedByExpiry) {
            showToast('Sharing is unavailable while this trip is expired.', { tone: 'neutral', title: 'Share disabled' });
            return;
        }
        if (!DB_ENABLED) {
            const url = window.location.href;
            try {
                await copyToClipboard(url);
                showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
            } catch (error) {
                showToast('Could not copy link', { tone: 'remove', title: 'Share link' });
                console.error('Copy failed', error);
            }
            return;
        }

        setIsShareOpen(true);
        void (async () => {
            const shares = await dbListTripShares(tripId);
            if (shares.length === 0) return;
            const mapped: Partial<Record<ShareMode, string>> = {};
            shares.forEach((share) => {
                if (!share.isActive) return;
                if (mapped[share.mode]) return;
                mapped[share.mode] = new URL(buildShareUrl(share.token), window.location.origin).toString();
            });
            if (Object.keys(mapped).length > 0) {
                setShareUrlsByMode((prev) => ({ ...prev, ...mapped }));
            }
        })();
    }, [canShare, isTripLockedByExpiry, setIsShareOpen, setShareUrlsByMode, showToast, tripId]);

    const handleCopyShareLink = useCallback(async () => {
        if (!activeShareUrl) return;
        try {
            await copyToClipboard(activeShareUrl);
            showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
        } catch (error) {
            showToast('Could not copy link', { tone: 'remove', title: 'Share link' });
            console.error('Copy failed', error);
        }
    }, [activeShareUrl, showToast]);

    const handleGenerateShare = useCallback(async () => {
        if (!DB_ENABLED) return;
        if (isTripLockedByExpiry) {
            showToast('Sharing is unavailable while this trip is expired.', { tone: 'neutral', title: 'Share disabled' });
            return;
        }

        setIsGeneratingShare(true);
        try {
            const sessionId = await ensureDbSession();
            if (!sessionId) {
                showToast('Anonymous auth is disabled. Enable it in Supabase.', { tone: 'remove', title: 'Share link' });
                return;
            }

            const upserted = await dbUpsertTrip(trip, currentViewSettings);
            const existing = await dbGetTrip(tripId);
            if (!upserted || !existing?.trip) {
                showToast('Could not save trip before sharing.', { tone: 'remove', title: 'Share link' });
                return;
            }

            const result = await dbCreateShareLink(tripId, shareMode);
            if (!result?.token) {
                showToast(result?.error || 'Could not create share link', { tone: 'remove', title: 'Share link' });
                return;
            }

            const url = new URL(buildShareUrl(result.token), window.location.origin).toString();
            setShareUrlsByMode((prev) => ({ ...prev, [shareMode]: url }));
            await copyToClipboard(url);
            showToast('Link copied to clipboard', { tone: 'info', title: 'Share link' });
        } catch (error) {
            showToast('Could not create share link', { tone: 'remove', title: 'Share link' });
            console.error('Share failed', error);
        } finally {
            setIsGeneratingShare(false);
        }
    }, [
        currentViewSettings,
        isTripLockedByExpiry,
        setIsGeneratingShare,
        setShareUrlsByMode,
        shareMode,
        showToast,
        trip,
        tripId,
    ]);

    return {
        activeShareUrl,
        handleShare,
        handleCopyShareLink,
        handleGenerateShare,
    };
};
