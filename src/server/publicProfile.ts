import { createServerFn } from '@tanstack/react-start';
import { normalizePublicProfileHandle, parsePublicProfilePageData, type PublicProfilePageData } from '../../shared/publicProfile';
/**
 * Public profile data for the `/u/$username` document. The handle is
 * normalized here; anything that cannot be a handle resolves to "not found"
 * without a database call. The read is anonymous and returns only public fields.
 *
 * Trips are stored JSON documents with open-ended fields that Start's
 * serializability types cannot prove, so the payload crosses the boundary as
 * the JSON text it already is and is parsed back on the calling side.
 */
const fetchPublicProfilePageJson = createServerFn({ method: 'GET' })
    .validator((handle: unknown) => normalizePublicProfileHandle(handle))
    .handler(async ({ data }) => {
        const { loadPublicProfilePageData } = await import('../../services/publicProfileServerService');
        return JSON.stringify(await loadPublicProfilePageData(data));
    });

export const getPublicProfilePageData = async (input: { data: unknown }): Promise<PublicProfilePageData> => (
    parsePublicProfilePageData(await fetchPublicProfilePageJson({ data: input.data }))
);
