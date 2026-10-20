import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { inspectOgUrl } from '../../services/adminOgToolsService';
import { getTripVideoAsset, getTripVideoState, requestTripVideo, setTripVideoImageSource, type TripVideoPreviewState } from '../../services/tripOgVideoService';
import type { TripVideoStyle } from '../../shared/tripOgVideo';

export const TripOgPreviewPanel: React.FC<{ tripId: string }> = ({ tripId }) => {
    const [state, setState] = useState<TripVideoPreviewState | null>(null);
    const [style, setStyle] = useState<TripVideoStyle>('clean');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let disposed = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let objectUrl: string | null = null;
        let checks = 0;
        setState(null);
        setError(null);
        setImageUrl(null);
        setVideoUrl(null);
        const load = async () => {
            try {
                const result = await getTripVideoState(tripId);
                if (disposed) return;
                setState(result);
                setStyle(result.style || 'clean');
                if (result.status === 'ready') {
                    const blob = await getTripVideoAsset(tripId, 'video');
                    if (disposed) return;
                    objectUrl = URL.createObjectURL(blob);
                    setVideoUrl(objectUrl);
                } else if (['queued', 'rendering'].includes(result.status) && checks++ < 60) {
                    timer = setTimeout(() => { void load(); }, 3000);
                }
            } catch (issue) {
                if (!disposed) setError(issue instanceof Error ? issue.message : 'Could not load trip preview.');
            }
        };
        void load();
        void inspectOgUrl(`/trip/${tripId}`, { origin: window.location.origin }).then(result => {
            if (!disposed) setImageUrl(result.resolvedOgImageUrl);
        }).catch(() => {});
        return () => {
            disposed = true;
            clearTimeout(timer);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [tripId, revision]);

    const generate = async () => {
        setBusy(true);
        setError(null);
        try {
            await requestTripVideo(tripId, { style, force: state?.status === 'ready' });
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
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Trip sharing previews</h3>
                <button type="button" onClick={() => setRevision(value => value + 1)} className="text-xs font-semibold text-accent-700">Refresh previews</button>
            </div>
            <p className="text-xs text-slate-500">1200 × 630 · 6 seconds · MP4 · no audio · maximum 2 MB. One render per trip per hour; 20 renders per hour across this deployment context. Platforms may display the image instead of playing video.</p>
            <div className="grid gap-3 lg:grid-cols-2">
                <figure className="min-w-0 space-y-2">
                    <figcaption className="text-xs font-semibold text-slate-600">Attached OG image</figcaption>
                    {imageUrl ? <img src={imageUrl} alt="Attached trip sharing preview" loading="lazy" width={1200} height={630} className="aspect-[1200/630] w-full rounded-lg border border-slate-200 object-contain" /> : <p className="text-xs text-slate-500">Image preview unavailable.</p>}
                </figure>
                <figure className="min-w-0 space-y-2">
                    <figcaption className="text-xs font-semibold text-slate-600">OG video · {state?.status || 'loading'}{state?.bytes ? ` · ${(state.bytes / 1024).toFixed(0)} KB` : ''}</figcaption>
                    {videoUrl ? <video src={videoUrl} controls muted loop playsInline preload="metadata" aria-label="Animated trip route preview" className="aspect-[1200/630] w-full rounded-lg border border-slate-200" /> : <div className="flex aspect-[1200/630] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">{rendering ? 'Your map animation is rendering in the background. You can leave this page.' : state?.error || 'Generate a short animation of this trip’s map and stops.'}</div>}
                </figure>
            </div>
            {state?.stale && <p className="text-xs text-amber-700">The itinerary changed since this video was rendered. Regenerate it to attach a current video.</p>}
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-36 space-y-1">
                    <span id={`video-style-${tripId}`} className="text-xs font-semibold text-slate-600">Video style</span>
                    <Select value={style} onValueChange={value => setStyle(value as TripVideoStyle)} disabled={busy || rendering}>
                        <SelectTrigger aria-labelledby={`video-style-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="clean">Clean</SelectItem><SelectItem value="dark">Dark</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="min-w-44 space-y-1">
                    <span id={`video-image-${tripId}`} className="text-xs font-semibold text-slate-600">Attached image source</span>
                    <Select value={state?.posterAsImage ? 'video-poster' : 'trip'} onValueChange={value => { void changeImageSource(value); }} disabled={busy || state?.status !== 'ready' || state?.stale}>
                        <SelectTrigger aria-labelledby={`video-image-${tripId}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="trip">Existing trip image</SelectItem><SelectItem value="video-poster">Video poster</SelectItem></SelectContent>
                    </Select>
                </div>
                <button type="button" onClick={() => { void generate(); }} disabled={busy || rendering} className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50">{busy ? 'Saving…' : rendering ? 'Rendering…' : state?.status === 'ready' ? 'Regenerate video' : 'Generate video'}</button>
                <a href={`/api/og/playground?trip=${encodeURIComponent(tripId)}`} target="_blank" rel="noreferrer" className="py-2 text-xs font-semibold text-accent-700">Open OG playground</a>
            </div>
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <p className="text-xs text-slate-500">Public media follows existing share access. Private trips can be previewed here without making them public. Saved-version links keep their image preview.</p>
        </section>
    );
};
