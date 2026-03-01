import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react';
import { type NavigateFunction } from 'react-router-dom';
import { findHistoryEntryByUrl, getHistoryEntries, type HistoryEntry } from '../../services/historyService';

export type HistoryAction = 'undo' | 'redo';

type HistoryToastTone = 'add' | 'remove' | 'update' | 'neutral' | 'info';

interface HistoryToastOptions {
    tone?: HistoryToastTone;
    title?: string;
    iconVariant?: 'undo' | 'redo';
}

interface UseTripHistoryControllerOptions {
    tripId: string;
    tripUpdatedAt?: number;
    locationPathname: string;
    currentUrl: string;
    isExamplePreview: boolean;
    navigate: NavigateFunction;
    suppressCommitRef: MutableRefObject<boolean>;
    stripHistoryPrefix: (label: string) => string;
    showToast: (message: string, options?: HistoryToastOptions) => void;
}

interface UseTripHistoryControllerResult {
    showAllHistory: boolean;
    setShowAllHistory: Dispatch<SetStateAction<boolean>>;
    refreshHistory: () => void;
    navigateHistory: (action: HistoryAction, options?: { silent?: boolean }) => boolean;
    formatHistoryTime: (timestamp: number) => string;
    displayHistoryEntries: HistoryEntry[];
}

export const useTripHistoryController = ({
    tripId,
    tripUpdatedAt,
    locationPathname,
    currentUrl,
    isExamplePreview,
    navigate,
    suppressCommitRef,
    stripHistoryPrefix,
    showToast,
}: UseTripHistoryControllerOptions): UseTripHistoryControllerResult => {
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const currentUrlRef = useRef(currentUrl);

    const refreshHistory = useCallback(() => {
        if (isExamplePreview) {
            setHistoryEntries([]);
            return;
        }
        setHistoryEntries(getHistoryEntries(tripId));
    }, [isExamplePreview, tripId]);

    const baseUrl = useMemo(() => {
        if (locationPathname.startsWith('/trip/')) {
            return `/trip/${encodeURIComponent(tripId)}`;
        }
        if (locationPathname.startsWith('/s/')) {
            return locationPathname;
        }
        return locationPathname;
    }, [locationPathname, tripId]);

    const resolvedHistoryEntries = useMemo(() => {
        const filteredEntries = historyEntries.filter((entry) => entry.url !== baseUrl);
        const latestEntry: HistoryEntry = {
            id: 'latest',
            tripId,
            url: baseUrl,
            label: 'Data: Latest version',
            ts: typeof tripUpdatedAt === 'number' ? tripUpdatedAt : Date.now(),
        };

        return [latestEntry, ...filteredEntries];
    }, [baseUrl, historyEntries, tripId, tripUpdatedAt]);

    const getHistoryIndex = useCallback((url: string) => {
        const index = resolvedHistoryEntries.findIndex((entry) => entry.url === url);
        return index >= 0 ? index : null;
    }, [resolvedHistoryEntries]);

    const getHistoryEntryForAction = useCallback((action: HistoryAction) => {
        if (resolvedHistoryEntries.length === 0) return null;
        const currentIndex = getHistoryIndex(currentUrlRef.current);
        const baseIndex = currentIndex ?? 0;
        const nextIndex = action === 'undo' ? baseIndex + 1 : baseIndex - 1;
        if (nextIndex < 0 || nextIndex >= resolvedHistoryEntries.length) return null;
        return resolvedHistoryEntries[nextIndex];
    }, [getHistoryIndex, resolvedHistoryEntries]);

    const navigateHistory = useCallback((action: HistoryAction, options?: { silent?: boolean }) => {
        const target = getHistoryEntryForAction(action);
        if (!target) {
            if (!options?.silent) {
                showToast(action === 'undo' ? 'No earlier history' : 'No later history', {
                    tone: 'neutral',
                    title: action === 'undo' ? 'Undo' : 'Redo',
                    iconVariant: action,
                });
            }
            return false;
        }

        suppressCommitRef.current = true;
        navigate(target.url, { replace: true });
        if (!options?.silent) {
            showToast(stripHistoryPrefix(target.label), {
                tone: 'neutral',
                title: action === 'undo' ? 'Undo' : 'Redo',
                iconVariant: action,
            });
        }
        return true;
    }, [getHistoryEntryForAction, navigate, showToast, stripHistoryPrefix, suppressCommitRef]);

    const formatHistoryTime = useCallback((timestamp: number) => {
        const diffMs = Date.now() - timestamp;
        const absMs = Math.abs(diffMs);
        const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        const sec = Math.round(absMs / 1000);
        if (sec < 60) return rtf.format(-sec, 'second');
        const min = Math.round(sec / 60);
        if (min < 60) return rtf.format(-min, 'minute');
        const hrs = Math.round(min / 60);
        if (hrs < 24) return rtf.format(-hrs, 'hour');
        const days = Math.round(hrs / 24);
        if (days < 7) return rtf.format(-days, 'day');
        return new Date(timestamp).toLocaleString();
    }, []);

    const displayHistoryEntries = useMemo(() => {
        if (isExamplePreview) return [];
        if (showAllHistory) return resolvedHistoryEntries;

        const seen = new Set<string>();
        return resolvedHistoryEntries.filter((entry) => {
            if (seen.has(entry.label)) return false;
            seen.add(entry.label);
            return true;
        });
    }, [isExamplePreview, resolvedHistoryEntries, showAllHistory]);

    useEffect(() => {
        currentUrlRef.current = currentUrl;
    }, [currentUrl]);

    useEffect(() => {
        refreshHistory();
    }, [refreshHistory]);

    useEffect(() => {
        if (isExamplePreview || typeof window === 'undefined') return;

        const handleHistoryUpdate = (event: Event) => {
            const detail = (event as CustomEvent<{ tripId?: string }>).detail;
            if (!detail || detail.tripId !== tripId) return;
            refreshHistory();
        };

        window.addEventListener('tf:history', handleHistoryUpdate);
        return () => window.removeEventListener('tf:history', handleHistoryUpdate);
    }, [isExamplePreview, refreshHistory, tripId]);

    useEffect(() => {
        if (isExamplePreview || typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isEditable = Boolean(target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ));
            if (isEditable) return;

            const isMeta = event.metaKey || event.ctrlKey;
            if (!isMeta) return;

            if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
                event.preventDefault();
                navigateHistory('undo');
            } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
                event.preventDefault();
                navigateHistory('redo');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExamplePreview, navigateHistory]);

    useEffect(() => {
        if (isExamplePreview || typeof window === 'undefined') return;

        const handlePopState = () => {
            const nextPath = window.location.pathname;
            const nextUrl = nextPath + window.location.search;
            const expectedTripPrefix = `/trip/${encodeURIComponent(tripId)}`;
            const isTripRoute = nextPath.startsWith('/trip/');
            const isShareRoute = nextPath.startsWith('/s/');

            if ((!isTripRoute && !isShareRoute) || (isTripRoute && !nextPath.startsWith(expectedTripPrefix))) {
                return;
            }

            suppressCommitRef.current = true;
            const entry = findHistoryEntryByUrl(tripId, nextUrl);
            const prevIndex = getHistoryIndex(currentUrlRef.current);
            const nextIndex = getHistoryIndex(nextUrl);
            const inferredAction = (prevIndex !== null && nextIndex !== null)
                ? (nextIndex > prevIndex ? 'undo' : 'redo')
                : null;

            if (entry) {
                showToast(stripHistoryPrefix(entry.label), {
                    tone: 'neutral',
                    title: inferredAction === 'redo' ? 'Redo' : 'Undo',
                    iconVariant: inferredAction === 'redo' ? 'redo' : 'undo',
                });
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [
        getHistoryIndex,
        isExamplePreview,
        navigate,
        showToast,
        stripHistoryPrefix,
        suppressCommitRef,
        tripId,
    ]);

    return {
        showAllHistory,
        setShowAllHistory,
        refreshHistory,
        navigateHistory,
        formatHistoryTime,
        displayHistoryEntries,
    };
};
