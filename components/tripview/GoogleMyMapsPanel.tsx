import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Lightbulb, MapPinned } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AppLanguage, ITimelineItem } from '../../types';
import type { SavedRecommendation } from '../../shared/recommendations';
import { hasIdeaCoordinates, selectNewIdeas } from '../../shared/googleMyMaps';
import {
    loadMyMapFromFile,
    loadMyMapFromLink,
    MyMapsImportError,
    resolveMissingIdeaPositions,
    type LoadedMyMap,
    type MyMapsImportErrorCode,
} from '../../services/googleMyMapsImportService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';

/**
 * Google My Maps in the trip info dialog: download the trip as a KML file for
 * My Maps, and bring a My Maps map's pins in as trip ideas.
 *
 * It lives in the dialog's export tab on purpose. Syncing with My Maps is a
 * niche job, and the planner itself should not carry a button for it.
 */

interface GoogleMyMapsPanelProps {
    tripId: string;
    canEdit: boolean;
    cities: ITimelineItem[];
    language: AppLanguage;
    keptIdeaIds: string[];
    /** Titles of activities already on the itinerary, so a re-import skips them. */
    activityTitles: string[];
    onExport: () => { placeCount: number; skippedCount: number } | null;
    /** Adds ideas to the trip and returns how many were new. */
    onImportIdeas: (ideas: SavedRecommendation[]) => number;
    onOpenIdeas?: () => void;
}

type ImportState =
    | { step: 'idle' }
    | { step: 'loading' }
    | { step: 'preview'; loaded: LoadedMyMap }
    | { step: 'locating'; done: number; total: number }
    | { step: 'done'; addedCount: number; unlocatedCount: number }
    | { step: 'error'; code: MyMapsImportErrorCode };

const toErrorCode = (error: unknown): MyMapsImportErrorCode => (
    error instanceof MyMapsImportError ? error.code : 'network'
);

export const GoogleMyMapsPanel: React.FC<GoogleMyMapsPanelProps> = ({
    tripId,
    canEdit,
    cities,
    language,
    keptIdeaIds,
    activityTitles,
    onExport,
    onImportIdeas,
    onOpenIdeas,
}) => {
    const { t } = useTranslation('common');
    const [link, setLink] = useState('');
    const [state, setState] = useState<ImportState>({ step: 'idle' });
    const [exportSkipped, setExportSkipped] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Position lookups outlive a click; closing the dialog must stop them.
    useEffect(() => () => abortRef.current?.abort(), []);

    const preview = state.step === 'preview' ? state.loaded : null;
    const newIdeas = useMemo(
        () => (preview ? selectNewIdeas(preview.ideas, { keptIdeaIds, activityTitles }) : []),
        [activityTitles, keptIdeaIds, preview],
    );

    const showLoaded = (loaded: LoadedMyMap) => {
        trackEvent('trip_view__my_maps_import--load', {
            trip_id: tripId,
            origin: loaded.origin,
            place_count: loaded.ideas.length,
        });
        setState({ step: 'preview', loaded });
    };

    const showError = (error: unknown, origin: 'link' | 'file') => {
        const code = toErrorCode(error);
        trackEvent('trip_view__my_maps_import--error', { trip_id: tripId, origin, code });
        setState({ step: 'error', code });
    };

    const handleLoadLink = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!link.trim() || state.step === 'loading') return;
        setState({ step: 'loading' });
        try {
            showLoaded(await loadMyMapFromLink(link));
        } catch (error) {
            showError(error, 'link');
        }
    };

    const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        setState({ step: 'loading' });
        try {
            showLoaded(await loadMyMapFromFile(file));
        } catch (error) {
            showError(error, 'file');
        }
    };

    const handleAdd = async () => {
        if (!preview || newIdeas.length === 0) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const resolved = await resolveMissingIdeaPositions(newIdeas, {
            cities,
            language,
            signal: controller.signal,
            onProgress: (done, total) => {
                if (total > 0 && !controller.signal.aborted) setState({ step: 'locating', done, total });
            },
        });
        if (controller.signal.aborted) return;

        const addedCount = onImportIdeas(resolved);
        const unlocatedCount = resolved.filter((idea) => !hasIdeaCoordinates(idea)).length;
        trackEvent('trip_view__my_maps_import--add', {
            trip_id: tripId,
            origin: preview.origin,
            place_count: preview.ideas.length,
            added_count: addedCount,
            unlocated_count: unlocatedCount,
        });
        setLink('');
        setState({ step: 'done', addedCount, unlocatedCount });
    };

    const handleExport = () => {
        const result = onExport();
        setExportSkipped(result && result.skippedCount > 0 ? result.skippedCount : null);
    };

    const reset = () => {
        abortRef.current?.abort();
        setState({ step: 'idle' });
    };

    const openIdeasButton = onOpenIdeas && (keptIdeaIds.length > 0 || state.step === 'done') ? (
        <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={() => {
                trackEvent('trip_view__my_maps_import--open_ideas', { trip_id: tripId });
                onOpenIdeas();
            }}
            data-testid="my-maps-open-ideas"
            {...getAnalyticsDebugAttributes('trip_view__my_maps_import--open_ideas', { trip_id: tripId })}
        >
            <Lightbulb />
            {t('tripView.infoDialog.myMaps.openIdeas')}
        </Button>
    ) : null;

    return (
        <section className="space-y-1" data-testid="google-my-maps-panel" aria-labelledby="google-my-maps-heading">
            <h3 id="google-my-maps-heading" className="flex items-center gap-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <MapPinned size={14} aria-hidden="true" />
                {t('tripView.infoDialog.myMaps.title')}
            </h3>
            <div className="divide-y divide-border border-y border-border">
                <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-foreground">{t('tripView.infoDialog.myMaps.export.title')}</h4>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('tripView.infoDialog.myMaps.export.description')}</p>
                        {exportSkipped !== null && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground" role="status">
                                {t('tripView.infoDialog.myMaps.export.skipped', { count: exportSkipped })}
                            </p>
                        )}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleExport}
                        data-testid="my-maps-export"
                        {...getAnalyticsDebugAttributes('trip_view__my_maps_export', { trip_id: tripId })}
                    >
                        {t('tripView.infoDialog.myMaps.export.action')}
                    </Button>
                </div>

                {canEdit && (
                    <div className="space-y-3 py-4">
                        <div>
                            <h4 className="text-sm font-semibold text-foreground">{t('tripView.infoDialog.myMaps.import.title')}</h4>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('tripView.infoDialog.myMaps.import.description')}</p>
                        </div>

                        {(state.step === 'idle' || state.step === 'loading' || state.step === 'error') && (
                            <>
                                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleLoadLink}>
                                    <label htmlFor="my-maps-link" className="sr-only">
                                        {t('tripView.infoDialog.myMaps.import.linkLabel')}
                                    </label>
                                    <Input
                                        id="my-maps-link"
                                        // Not type="url": links copied without "https://"
                                        // are valid here, and the browser would refuse them.
                                        type="text"
                                        inputMode="url"
                                        autoComplete="off"
                                        spellCheck={false}
                                        value={link}
                                        onChange={(event) => setLink(event.currentTarget.value)}
                                        placeholder={t('tripView.infoDialog.myMaps.import.linkPlaceholder')}
                                        aria-invalid={state.step === 'error' && state.code === 'invalid_link' ? true : undefined}
                                        aria-describedby={state.step === 'error' ? 'my-maps-error' : undefined}
                                        className="min-w-0 flex-1"
                                        data-testid="my-maps-link-input"
                                    />
                                    <Button
                                        type="submit"
                                        disabled={!link.trim() || state.step === 'loading'}
                                        data-testid="my-maps-load"
                                        {...getAnalyticsDebugAttributes('trip_view__my_maps_import--load', { trip_id: tripId, origin: 'link' })}
                                    >
                                        {state.step === 'loading' && <Spinner />}
                                        {t(state.step === 'loading' ? 'tripView.infoDialog.myMaps.import.loading' : 'tripView.infoDialog.myMaps.import.load')}
                                    </Button>
                                </form>
                                {state.step === 'error' && (
                                    <p id="my-maps-error" role="alert" className="text-sm leading-6 text-destructive" data-testid="my-maps-error">
                                        {t(`tripView.infoDialog.myMaps.errors.${state.code}`)}
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz"
                                        className="sr-only"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        onChange={handleFile}
                                        data-testid="my-maps-file-input"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={state.step === 'loading'}
                                        onClick={() => fileInputRef.current?.click()}
                                        {...getAnalyticsDebugAttributes('trip_view__my_maps_import--load', { trip_id: tripId, origin: 'file' })}
                                    >
                                        <FileUp />
                                        {t('tripView.infoDialog.myMaps.import.upload')}
                                    </Button>
                                    {openIdeasButton}
                                </div>
                            </>
                        )}

                        {preview && (
                            <div className="rounded-md bg-secondary px-4 py-3" data-testid="my-maps-preview">
                                <p className="text-sm font-semibold text-foreground">
                                    {preview.document.name || t('tripView.infoDialog.myMaps.preview.untitled')}
                                </p>
                                <ul className="mt-1 space-y-0.5 text-sm leading-6 text-muted-foreground">
                                    <li>{t('tripView.infoDialog.myMaps.preview.places', { count: preview.ideas.length })}</li>
                                    {preview.ideas.length > newIdeas.length && (
                                        <li>{t('tripView.infoDialog.myMaps.preview.alreadyKept', { count: preview.ideas.length - newIdeas.length })}</li>
                                    )}
                                    {preview.document.skippedShapeCount > 0 && (
                                        <li>{t('tripView.infoDialog.myMaps.preview.shapes', { count: preview.document.skippedShapeCount })}</li>
                                    )}
                                </ul>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {newIdeas.length > 0 ? (
                                        <Button
                                            type="button"
                                            onClick={handleAdd}
                                            data-testid="my-maps-add"
                                            {...getAnalyticsDebugAttributes('trip_view__my_maps_import--add', { trip_id: tripId })}
                                        >
                                            {t('tripView.infoDialog.myMaps.preview.add', { count: newIdeas.length })}
                                        </Button>
                                    ) : (
                                        <p className="text-sm font-medium text-foreground">{t('tripView.infoDialog.myMaps.preview.nothingNew')}</p>
                                    )}
                                    <Button type="button" variant="ghost" onClick={reset}>
                                        {t('tripView.infoDialog.myMaps.preview.cancel')}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {state.step === 'locating' && (
                            <div className="space-y-2" role="status" data-testid="my-maps-progress">
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Spinner />
                                    {t('tripView.infoDialog.myMaps.progress', { done: state.done, total: state.total })}
                                </p>
                                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width]"
                                        style={{ width: `${Math.round((state.done / Math.max(state.total, 1)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {state.step === 'done' && (
                            <div className="space-y-3" role="status" data-testid="my-maps-done">
                                <p className="text-sm font-semibold text-foreground">
                                    {t('tripView.infoDialog.myMaps.done.added', { count: state.addedCount })}
                                </p>
                                <p className="text-sm leading-6 text-muted-foreground">
                                    {t('tripView.infoDialog.myMaps.done.onMap')}
                                </p>
                                {state.unlocatedCount > 0 && (
                                    <p className="text-sm leading-6 text-muted-foreground">
                                        {t('tripView.infoDialog.myMaps.done.unlocated', { count: state.unlocatedCount })}
                                    </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {openIdeasButton}
                                    <Button type="button" variant="ghost" size="sm" onClick={reset}>
                                        {t('tripView.infoDialog.myMaps.done.importAnother')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};
