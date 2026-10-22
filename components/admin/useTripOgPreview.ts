import { useEffect, useState } from 'react';
import { inspectOgUrl } from '../../services/adminOgToolsService';
import { getTripVideoAsset, getTripVideoState, type TripVideoPreviewState } from '../../services/tripOgVideoService';

const useBlobUrl = (blob: Blob | null) => {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!blob) { setUrl(null); return; }
        const next = URL.createObjectURL(blob);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [blob]);
    return url;
};

export const useTripOgPreview = (tripId: string, revision: number) => {
    const [state, setState] = useState<TripVideoPreviewState | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [blob, setBlob] = useState<Blob | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    useEffect(() => {
        let disposed = false, loading = false, checks = 0, finished = false;
        setState(null); setBlob(null); setImageUrl(null); setLoadError(null);
        let loadedMediaKey: string | null = null;
        const loadImage = async (key: string | number) => {
            const result = await inspectOgUrl(`/trip/${tripId}?og_preview=${key}`, { origin: window.location.origin });
            if (!disposed) setImageUrl(result.resolvedOgImageUrl);
        };
        const load = async () => {
            if (loading || finished || disposed) return;
            loading = true;
            try {
                const result = await getTripVideoState(tripId);
                if (disposed) return;
                setState(result);
                finished = !['queued', 'rendering'].includes(result.status) || ++checks >= 60;
                const media = result.status === 'ready' ? result : result.attached;
                const mediaKey = media?.mediaRevision || media?.revision;
                if (media && mediaKey !== loadedMediaKey) {
                    loadedMediaKey = mediaKey || null;
                    const next = await getTripVideoAsset(tripId, 'video');
                    if (!disposed) setBlob(next);
                    if (result.status === 'ready') void loadImage(mediaKey || revision).catch(() => {});
                }
            } catch (issue) {
                finished = true;
                if (!disposed) setLoadError(issue instanceof Error ? issue.message : 'Could not load trip preview.');
            } finally { loading = false; }
        };
        void load();
        const timer = setInterval(() => { if (finished) clearInterval(timer); else void load(); }, 3000);
        void loadImage(revision).catch(() => {});
        return () => { disposed = true; clearInterval(timer); };
    }, [tripId, revision]);
    const videoUrl = useBlobUrl(blob);
    return { state, imageUrl, videoUrl, loadError };
};
