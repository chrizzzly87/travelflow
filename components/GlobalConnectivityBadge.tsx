import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConnectivityStatus } from '../hooks/useConnectivityStatus';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { Spinner } from './ui/spinner';

type BadgeState = 'offline' | 'syncing' | 'online';

const ONLINE_BADGE_VISIBLE_MS = 3500;

export const GlobalConnectivityBadge: React.FC = () => {
    const { t } = useTranslation('common');
    const { isOnline, isProbePending } = useNetworkStatus();
    const { snapshot: connectivitySnapshot } = useConnectivityStatus();
    const { snapshot: syncSnapshot } = useSyncStatus();

    const badgeState = useMemo<BadgeState>(() => {
        if (!isOnline) return 'offline';
        if (connectivitySnapshot.state !== 'online') return 'syncing';
        if (isProbePending) return 'syncing';
        if (syncSnapshot.isSyncing || syncSnapshot.pendingCount > 0) return 'syncing';
        return 'online';
    }, [connectivitySnapshot.state, isOnline, isProbePending, syncSnapshot.isSyncing, syncSnapshot.pendingCount]);

    const [showOnlineBadge, setShowOnlineBadge] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const previousStateRef = useRef<BadgeState>(badgeState);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout> | null = null;
        const previousState = previousStateRef.current;
        previousStateRef.current = badgeState;

        if (badgeState === 'online') {
            if (previousState !== 'online') {
                setShowOnlineBadge(true);
                timerId = setTimeout(() => {
                    setShowOnlineBadge(false);
                }, ONLINE_BADGE_VISIBLE_MS);
            }
        } else {
            setShowOnlineBadge(false);
        }

        return () => {
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [badgeState]);

    const shouldRender = badgeState !== 'online' || showOnlineBadge;
    if (!shouldRender) return null;

    const detailsCopy = (() => {
        if (!isOnline) {
            return t('connectivity.globalBadge.details.offlineBrowser');
        }
        if (connectivitySnapshot.state !== 'online') {
            return t('connectivity.globalBadge.details.offlineService');
        }
        if (isProbePending || syncSnapshot.isSyncing || syncSnapshot.pendingCount > 0) {
            return t('connectivity.globalBadge.details.syncingQueue', { count: syncSnapshot.pendingCount });
        }
        return t('connectivity.globalBadge.details.online');
    })();

    const pulsingDot = (tone: 'offline' | 'online') => (
        <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" aria-hidden="true">
            <span
                className={`absolute inset-0 rounded-full border ${
                    tone === 'offline' ? 'border-rose-400/80' : 'border-emerald-400/80'
                } animate-ping`}
            />
            <span
                className={`absolute inset-0 rounded-full border ${
                    tone === 'offline' ? 'border-rose-400/70' : 'border-emerald-400/70'
                } animate-ping [animation-delay:900ms]`}
            />
            <span className={`relative h-2 w-2 rounded-full ${tone === 'offline' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        </span>
    );

    const palette = badgeState === 'offline'
        ? {
            shell: 'border-rose-300 bg-rose-50/95 text-rose-900',
            icon: pulsingDot('offline'),
            label: t('connectivity.globalBadge.offline'),
        }
        : badgeState === 'syncing'
            ? {
                shell: 'border-amber-300 bg-amber-50/95 text-amber-900',
                icon: <Spinner className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />,
                label: t('connectivity.globalBadge.syncing'),
            }
            : {
                shell: 'border-emerald-300 bg-emerald-50/95 text-emerald-900',
                icon: pulsingDot('online'),
                label: t('connectivity.globalBadge.online'),
            };

    return (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[22000] flex justify-center px-3 sm:top-auto sm:bottom-4">
            <div
                className="pointer-events-auto relative"
                onMouseEnter={() => setDetailsOpen(true)}
                onMouseLeave={() => setDetailsOpen(false)}
            >
                <button
                    type="button"
                    role="status"
                    aria-live="polite"
                    aria-expanded={detailsOpen}
                    onClick={() => setDetailsOpen((value) => !value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${palette.shell}`}
                >
                    {palette.icon}
                    <span>{palette.label}</span>
                </button>

                {detailsOpen && (
                    <div
                        role="tooltip"
                        className="absolute left-1/2 top-full z-10 mt-2 w-[min(92vw,360px)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-medium text-slate-700 shadow-lg backdrop-blur sm:bottom-full sm:top-auto sm:mb-2 sm:mt-0"
                    >
                        {detailsCopy}
                    </div>
                )}
            </div>
        </div>
    );
};
