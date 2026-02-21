import {
    useCallback,
    useMemo,
    type ComponentType,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { type HistoryEntry } from '../../services/historyService';
import { type TripHistoryModalItem } from '../TripHistoryModal';

export type ChangeTone = 'add' | 'remove' | 'update' | 'neutral' | 'info';

export type TripHistoryOpenSource = 'desktop_header' | 'mobile_header' | 'trip_info';

interface ToneMeta {
    label: string;
    iconClass: string;
    badgeClass: string;
    toastBorderClass: string;
    toastTitleClass: string;
    Icon: ComponentType<{ size?: number }>;
}

export interface TripInfoHistoryItem {
    id: string;
    url: string;
    ts: number;
    details: string;
    isCurrent: boolean;
}

interface UseTripHistoryPresentationOptions {
    currentUrl: string;
    displayHistoryEntries: HistoryEntry[];
    refreshHistory: () => void;
    setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
    showAllHistory: boolean;
    trackOpenHistory?: (source: TripHistoryOpenSource) => void;
}

interface UseTripHistoryPresentationResult {
    historyModalItems: TripHistoryModalItem[];
    openHistoryPanel: (source: TripHistoryOpenSource) => void;
    tripInfoHistoryItems: TripInfoHistoryItem[];
}

export const stripHistoryPrefix = (label: string) => label.replace(/^(Data|Visual):\s*/i, '').trim();

export const resolveChangeTone = (label: string): ChangeTone => {
    const normalized = label.toLowerCase();

    if (/\b(add|added|create|created)\b/.test(normalized)) return 'add';
    if (/\b(remove|removed|delete|deleted)\b/.test(normalized)) return 'remove';
    if (
        /\b(update|updated|change|changed|rename|renamed|reschedule|rescheduled|reorder|reordered|adjust|adjusted|saved)\b/.test(normalized) ||
        normalized.startsWith('visual:')
    ) {
        return 'update';
    }

    return 'info';
};

export const getToneMeta = (tone: ChangeTone): ToneMeta => {
    switch (tone) {
        case 'add':
            return {
                label: 'Added',
                iconClass: 'bg-emerald-100 text-emerald-700',
                badgeClass: 'bg-emerald-100 text-emerald-700',
                toastBorderClass: 'border-emerald-200',
                toastTitleClass: 'text-emerald-700',
                Icon: Plus,
            };
        case 'remove':
            return {
                label: 'Removed',
                iconClass: 'bg-red-100 text-red-700',
                badgeClass: 'bg-red-100 text-red-700',
                toastBorderClass: 'border-red-200',
                toastTitleClass: 'text-red-700',
                Icon: Trash2,
            };
        case 'update':
            return {
                label: 'Updated',
                iconClass: 'bg-accent-100 text-accent-700',
                badgeClass: 'bg-accent-100 text-accent-700',
                toastBorderClass: 'border-accent-200',
                toastTitleClass: 'text-accent-700',
                Icon: Pencil,
            };
        case 'neutral':
            return {
                label: 'Notice',
                iconClass: 'bg-amber-100 text-amber-700',
                badgeClass: 'bg-amber-100 text-amber-700',
                toastBorderClass: 'border-amber-200',
                toastTitleClass: 'text-amber-700',
                Icon: Info,
            };
        default:
            return {
                label: 'Saved',
                iconClass: 'bg-slate-100 text-slate-700',
                badgeClass: 'bg-slate-100 text-slate-700',
                toastBorderClass: 'border-slate-200',
                toastTitleClass: 'text-slate-700',
                Icon: Info,
            };
    }
};

export const useTripHistoryPresentation = ({
    currentUrl,
    displayHistoryEntries,
    refreshHistory,
    setIsHistoryOpen,
    showAllHistory,
    trackOpenHistory,
}: UseTripHistoryPresentationOptions): UseTripHistoryPresentationResult => {
    const historyModalItems = useMemo<TripHistoryModalItem[]>(() => {
        return displayHistoryEntries.map((entry) => {
            const tone = resolveChangeTone(entry.label);
            return {
                id: entry.id,
                url: entry.url,
                ts: entry.ts,
                isCurrent: entry.url === currentUrl,
                details: stripHistoryPrefix(entry.label),
                tone,
                meta: getToneMeta(tone),
            };
        });
    }, [displayHistoryEntries, currentUrl]);

    const infoHistoryEntries = useMemo(() => {
        return showAllHistory ? displayHistoryEntries : displayHistoryEntries.slice(0, 8);
    }, [displayHistoryEntries, showAllHistory]);

    const tripInfoHistoryItems = useMemo<TripInfoHistoryItem[]>(() => {
        return infoHistoryEntries.map((entry) => ({
            id: entry.id,
            url: entry.url,
            ts: entry.ts,
            details: stripHistoryPrefix(entry.label),
            isCurrent: entry.url === currentUrl,
        }));
    }, [infoHistoryEntries, currentUrl]);

    const openHistoryPanel = useCallback((source: TripHistoryOpenSource) => {
        trackOpenHistory?.(source);
        refreshHistory();
        setIsHistoryOpen(true);
    }, [refreshHistory, setIsHistoryOpen, trackOpenHistory]);

    return {
        historyModalItems,
        openHistoryPanel,
        tripInfoHistoryItems,
    };
};
