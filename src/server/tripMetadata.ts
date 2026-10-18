import { createServerFn } from '@tanstack/react-start';
/** Only public share-backed summaries are returned; provider credentials stay server-only. */
export const getTripDocumentMetadata = createServerFn({ method: 'GET' })
    .validator((path: string) => {
        if (typeof path !== 'string' || !/^\/(?:trip|s)\//.test(path) || path.length > 16000) throw new Error('Invalid trip metadata path');
        return path;
    })
    .handler(async ({ data }) => {
        const { resolveTripDocumentMetadata } = await import('../../netlify/edge-functions/trip-og-meta');
        return resolveTripDocumentMetadata(new Request(new URL(data, 'https://travelflowapp.netlify.app')));
    });
