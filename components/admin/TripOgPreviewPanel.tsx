import React, { useState } from 'react';
import { useSearchParams } from '../../app/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTripOgPreview } from './useTripOgPreview';
import { requestTripVideo, setTripVideoImageSource } from '../../services/tripOgVideoService';
import { normalizeTripVideoFormat, tripVideoDimensions, normalizeTripVideoStyle, normalizeTripVideoRouteMode, type TripVideoRouteMode, type TripVideoStyle, type TripVideoFormat } from '../../shared/tripOgVideo';

export const TripOgPreviewPanel: React.FC<{ tripId: string }> = ({ tripId }) => {
    const [initialSettings] = useSearchParams();
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
        } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not generate video.'); }
        finally { setBusy(false); }
    };
    const changeImageSource = async (source: string) => {
        setBusy(true);
        setError(null);
        try {
            await setTripVideoImageSource(tripId, source === 'video-poster');
            setRevision(value => value + 1);
        } catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not change image source.'); }
        finally { setBusy(false); }
    };
    const rendering = state?.status === 'queued' || state?.status === 'rendering';
    return (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Trip sharing previews</h3>
                <button type="button" onClick={() => setRevision(value => value + 1)} className="text-xs font-semibold text-accent-700">Refresh previews</button>
            </div>
            <p className="text-xs text-muted-foreground">Wide 1200 × 630 or classic 960 × 720 · 6 seconds · MP4 · no audio · maximum 2 MB. Mapbox basemap. Automatic renders are limited to once per trip per hour. Explicit re-renders have a five-minute cooldown; 20 renders per hour across this deployment context. Platforms may display the image instead of playing video.</p>
            <div className="grid gap-3 lg:grid-cols-2">
                <figure className="min-w-0 space-y-2">
                    <figcaption className="text-xs font-semibold text-muted-foreground">Attached OG image</figcaption>
                    {imageUrl ? <img src={imageUrl} alt="Attached trip sharing preview" loading="lazy" width={imageDimensions.width} height={imageDimensions.height} style={{ aspectRatio: `${imageDimensions.width} / ${imageDimensions.height}` }} className="w-full rounded-lg border border-border object-contain" /> : <p className="text-xs text-muted-foreground">Image preview unavailable.</p>}
                </figure>
                <figure className="min-w-0 space-y-2">
                    <figcaption className="text-xs font-semibold text-muted-foreground">OG video · {state?.status || 'loading'}{state?.bytes ? ` · ${(state.bytes / 1024).toFixed(0)} KB` : ''}</figcaption>
                    {videoUrl ? <video src={videoUrl} controls muted loop playsInline preload="metadata" aria-label="Animated trip route preview" style={{ aspectRatio }} className="w-full rounded-lg border border-border object-contain" /> : <div style={{ aspectRatio }} className="flex items-center justify-center rounded-lg border border-dashed border-border bg-secondary px-4 text-center text-xs text-muted-foreground">{rendering ? 'Your map animation is rendering in the background. You can leave this page.' : state?.error || 'Generate a short animation of this trip’s map and stops.'}</div>}
                </figure>
            </div>
            {state?.stale && <p className="text-xs text-amber-700">The itinerary changed since this video was rendered. Regenerate it to attach a current video.</p>}
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-36 space-y-1">
                    <span id={`video-style-${tripId}`} className="text-xs font-semibold text-muted-foreground">Map style</span>
                    <Select value={style} onValueChange={value => setStyle(value as TripVideoStyle)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-style-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="clean">Clean</SelectItem><SelectItem value="minimal">Minimal</SelectItem><SelectItem value="standard">Standard</SelectItem><SelectItem value="dark">Dark</SelectItem><SelectItem value="satellite">Satellite</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-36 space-y-1">
                    <span id={`video-route-${tripId}`} className="text-xs font-semibold text-muted-foreground">Route style</span>
                    <Select value={routeMode} onValueChange={value => setRouteMode(value as TripVideoRouteMode)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-route-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="simple">Simple</SelectItem><SelectItem value="realistic">Realistic</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-44 space-y-1">
                    <span id={`video-format-${tripId}`} className="text-xs font-semibold text-muted-foreground">Video ratio</span>
                    <Select value={format} onValueChange={value => setFormat(value as TripVideoFormat)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-format-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="wide">Wide · 1.91:1</SelectItem><SelectItem value="classic">Classic · 4:3</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-44 space-y-1">
                    <span id={`video-image-${tripId}`} className="text-xs font-semibold text-muted-foreground">Attached image source</span>
                    <Select value={state?.posterAsImage ? 'video-poster' : 'trip'} onValueChange={value => { void changeImageSource(value); }} disabled={busy || state?.status !== 'ready' || state?.stale}>
                        <SelectTrigger aria-labelledby={`video-image-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="trip">Existing trip image</SelectItem><SelectItem value="video-poster">Video poster</SelectItem></SelectContent>
                    </Select>
                </div>
                <button type="button" onClick={() => { void generate(false); }} disabled={busy || rendering} className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">{busy ? 'Saving…' : rendering ? 'Rendering…' : state?.status === 'ready' ? 'Apply settings' : 'Generate video'}</button>
                {state?.status === 'ready' && <button type="button" onClick={() => { void generate(true); }} disabled={busy || rendering} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">Re-render & refresh cache</button>}
                <a href={`/api/og/playground?trip=${encodeURIComponent(tripId)}&mapStyle=${style}&routeMode=${routeMode}&format=${format}`} target="_blank" rel="noreferrer" className="py-2 text-xs font-semibold text-accent-700">Open OG playground</a>
            </div>
            {state?.status === 'ready' && settingsChanged && <p className="text-xs text-amber-700">These settings differ from the attached video. Apply settings to render them; changing a control does not start a render.</p>}
            <p className="text-xs text-muted-foreground">Only the selected ratio is rendered; extra variants are never generated automatically. Messages chooses its own preview crop, so try Classic if Wide is cropped. Apply settings reuses an identical cached video. Re-render replaces it and refreshes its media URL. Realistic routes reuse cached geometry and use at most eight new directions lookups per render, with straight lines where routing is unavailable. Day trips use the same departure and return stays as the planner, with dashed spokes and stay-colored markers. Leg colors follow each departing stay.</p>
            {(error || loadError) && <p role="alert" className="text-xs text-red-700">{error || loadError}</p>}
            <p className="text-xs text-muted-foreground">Public media follows existing share access. Private trips can be previewed here without making them public. Saved-version links keep their image preview.</p>
        </section>
    );
};
