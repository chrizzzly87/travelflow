import React, { useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { AdminSurfaceCard } from './AdminSurfaceCard';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminErrorAlert } from './AdminErrorAlert';
import { AdminStatusBadge, type AdminStatusTone } from './AdminStatusBadge';
import { useTripOgPreview } from './useTripOgPreview';
import { requestTripVideo, setTripVideoImageSource } from '../../services/tripOgVideoService';
import { normalizeTripVideoFormat, tripVideoDimensions, normalizeTripVideoStyle, normalizeTripVideoRouteMode, type TripVideoRouteMode, type TripVideoStyle, type TripVideoFormat } from '../../shared/tripOgVideo';

// The video service throws authored sentences (`new Error('…')`); a timeout or
// network failure arrives as a DOMException/TypeError and gets one of ours.
const toAuthoredMessage = (issue: unknown, fallback: string): string => (
    issue instanceof Error && issue.constructor === Error && issue.message ? issue.message : fallback
);

const STATUS_TONE: Record<string, AdminStatusTone> = {
    ready: 'success',
    queued: 'info',
    rendering: 'info',
    failed: 'danger',
    missing: 'neutral',
};

const fieldLabelClass = 'text-xs font-medium text-muted-foreground';

export const TripOgPreviewPanel: React.FC<{ tripId: string }> = ({ tripId }) => {
    const initialSettings = new URLSearchParams(window.location.search);
    const [selectedStyle, setStyle] = useState<TripVideoStyle | null>(() => initialSettings.has('mapStyle') ? normalizeTripVideoStyle(initialSettings.get('mapStyle')) : null);
    const [selectedRouteMode, setRouteMode] = useState<TripVideoRouteMode | null>(() => initialSettings.has('routeMode') ? normalizeTripVideoRouteMode(initialSettings.get('routeMode')) : null);
    const [selectedFormat, setFormat] = useState<TripVideoFormat | null>(() => initialSettings.has('format') ? normalizeTripVideoFormat(initialSettings.get('format')) : null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    const { state, imageUrl, videoUrl, loadError } = useTripOgPreview(tripId, revision);
    // Query settings seed a draft once. Later refreshes never overwrite edits.
    const style = selectedStyle || state?.style || 'standard';
    const routeMode = selectedRouteMode || state?.routeMode || 'simple';
    const format = selectedFormat || state?.format || 'wide';
    const activeMedia = state?.status === 'ready' ? state : state?.attached;
    const dimensions = tripVideoDimensions(activeMedia?.format);
    const imageDimensions = activeMedia?.posterAsImage ? dimensions : tripVideoDimensions();
    const aspectRatio = `${dimensions.width} / ${dimensions.height}`;
    const settingsChanged = state?.style !== style || (state?.routeMode || 'simple') !== routeMode || normalizeTripVideoFormat(state?.format) !== format;
    const generate = async (force = false) => {
        setBusy(true);
        setError(null);
        try {
            await requestTripVideo(tripId, { style, routeMode, format, force: force || state?.status === 'failed' || Boolean(state?.stale) || Boolean(state?.status === 'ready' && settingsChanged) });
            setRevision(value => value + 1);
        } catch (issue) { setError(toAuthoredMessage(issue, 'Could not generate the video. Try again in a moment.')); }
        finally { setBusy(false); }
    };
    const changeImageSource = async (source: string) => {
        setBusy(true);
        setError(null);
        try {
            await setTripVideoImageSource(tripId, source === 'video-poster');
            setRevision(value => value + 1);
        } catch (issue) { setError(toAuthoredMessage(issue, 'Could not change the image source. Try again in a moment.')); }
        finally { setBusy(false); }
    };
    const rendering = state?.status === 'queued' || state?.status === 'rendering';
    const statusLabel = state?.status || 'loading';
    return (
        <AdminSurfaceCard className="flex flex-col gap-4">
            <AdminSectionHeader
                as="h3"
                title="Trip sharing previews"
                description="Wide 1200 × 630 or classic 960 × 720 · 6 seconds · MP4 · no audio · maximum 2 MB · Mapbox basemap."
                actions={(
                    <Button type="button" variant="ghost" size="sm" onClick={() => setRevision(value => value + 1)}>
                        <ArrowsClockwise aria-hidden="true" />
                        Refresh previews
                    </Button>
                )}
            />
            <p className="text-xs text-muted-foreground">Automatic renders are limited to once per trip per hour. Explicit re-renders have a five-minute cooldown; 20 renders per hour across this deployment context. Platforms may display the image instead of playing video.</p>
            <div className="grid gap-4 lg:grid-cols-2">
                <figure className="flex min-w-0 flex-col gap-2">
                    <figcaption className={fieldLabelClass}>Attached OG image</figcaption>
                    {imageUrl ? <img src={imageUrl} alt="Attached trip sharing preview" loading="lazy" width={imageDimensions.width} height={imageDimensions.height} style={{ aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}` }} className="w-full rounded-md border border-border object-contain" /> : <p className="text-xs text-muted-foreground">Image preview unavailable.</p>}
                </figure>
                <figure className="flex min-w-0 flex-col gap-2">
                    <figcaption className={`${fieldLabelClass} flex flex-wrap items-center gap-2`}>
                        OG video
                        <AdminStatusBadge tone={STATUS_TONE[statusLabel] || 'neutral'}>{statusLabel}</AdminStatusBadge>
                        {state?.bytes ? <span className="tabular-nums">{(state.bytes / 1024).toFixed(0)} KB</span> : null}
                    </figcaption>
                    {videoUrl ? <video src={videoUrl} controls muted loop playsInline preload="metadata" aria-label="Animated trip route preview" style={{ aspectRatio }} className="w-full rounded-md border border-border object-contain" /> : <div style={{ aspectRatio }} className="flex items-center justify-center rounded-md border border-dashed border-border bg-muted/40 px-4 text-center text-xs text-muted-foreground">{rendering ? 'Your map animation is rendering in the background. You can leave this page.' : state?.error || 'Generate a short animation of this trip’s map and stops.'}</div>}
                </figure>
            </div>
            {state?.stale && (
                <Alert variant="warning">
                    <AlertDescription>The itinerary changed since this video was rendered. Regenerate it to attach a current video.</AlertDescription>
                </Alert>
            )}
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-36 flex-col gap-1.5">
                    <span id={`video-style-${tripId}`} className={fieldLabelClass}>Map style</span>
                    <Select value={style} onValueChange={value => setStyle(value as TripVideoStyle)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-style-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="clean">Clean</SelectItem><SelectItem value="minimal">Minimal</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="satellite">Satellite</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex min-w-36 flex-col gap-1.5">
                    <span id={`video-route-${tripId}`} className={fieldLabelClass}>Route style</span>
                    <Select value={routeMode} onValueChange={value => setRouteMode(value as TripVideoRouteMode)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-route-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="simple">Simple</SelectItem><SelectItem value="realistic">Realistic</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex min-w-44 flex-col gap-1.5">
                    <span id={`video-format-${tripId}`} className={fieldLabelClass}>Video ratio</span>
                    <Select value={format} onValueChange={value => setFormat(value as TripVideoFormat)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-format-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="wide">Wide · 1.91:1</SelectItem><SelectItem value="classic">Classic · 4:3</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex min-w-44 flex-col gap-1.5">
                    <span id={`video-image-${tripId}`} className={fieldLabelClass}>Attached image source</span>
                    <Select value={state?.posterAsImage ? 'video-poster' : 'trip'} onValueChange={value => { void changeImageSource(value); }} disabled={busy || state?.status !== 'ready' || state?.stale}>
                        <SelectTrigger aria-labelledby={`video-image-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="trip">Existing trip image</SelectItem><SelectItem value="video-poster">Video poster</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => { void generate(false); }} disabled={busy || rendering}>{busy ? 'Saving…' : rendering ? 'Rendering…' : state?.status === 'ready' ? 'Apply settings' : 'Generate video'}</Button>
                    {state?.status === 'ready' && <Button type="button" variant="outline" onClick={() => { void generate(true); }} disabled={busy || rendering}>Re-render & refresh cache</Button>}
                    <Button asChild variant="link" size="sm">
                        <a href={`/api/og/playground?trip=${encodeURIComponent(tripId)}&mapStyle=${style}&routeMode=${routeMode}&format=${format}`} target="_blank" rel="noreferrer">Open OG playground</a>
                    </Button>
                </div>
            </div>
            {state?.status === 'ready' && settingsChanged && <p className="text-xs text-amber-700 dark:text-amber-300">These settings differ from the attached video. Apply settings to render them; changing a control does not start a render.</p>}
            {(error || loadError) && <AdminErrorAlert message={error || loadError} />}
            <p className="text-xs text-muted-foreground">Only the selected ratio is rendered; extra variants are never generated automatically. Messages chooses its own preview crop, so try Classic if Wide is cropped. Apply settings reuses an identical cached video. Re-render replaces it and refreshes its media URL. Realistic routes reuse cached geometry and use at most eight new directions lookups per render, with straight lines where routing is unavailable. Day trips use the same departure and return stays as the planner, with dashed spokes and stay-colored markers. Leg colors follow each departing stay.</p>
            <p className="text-xs text-muted-foreground">Public media follows existing share access. Private trips can be previewed here without making them public. Saved-version links keep their image preview.</p>
        </AdminSurfaceCard>
    );
};
