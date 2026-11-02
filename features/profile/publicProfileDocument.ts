import { localeToDir, normalizeLocale } from '../../config/locales';
import { buildPath } from '../../config/routes';
import { APP_NAME } from '../../config/appGlobals';
import { buildDynamicSiteOgImageUrl } from '../../netlify/edge-lib/site-og-metadata';
import { privateDocumentCacheHeaders, publicProfileDocumentCacheHeaders } from '../../app/routing/cachePolicy';
import { resolvePublicProfileDisplayName, type PublicProfilePageData } from '../../shared/publicProfile';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface PublicProfileHeadInput {
    data: PublicProfilePageData | undefined;
    /** Translator bound to the `profile` namespace in the document locale. */
    t: Translate;
    locale: string;
    /** Origin for the Open Graph image, the same one the root metadata uses. */
    origin: string;
}

const DESCRIPTION_MAX_LENGTH = 160;

const toMetaDescription = (value: string): string => {
    const collapsed = value.replace(/\s+/g, ' ').trim();
    return collapsed.length > DESCRIPTION_MAX_LENGTH
        ? `${collapsed.slice(0, DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
        : collapsed;
};

/**
 * Per-profile document metadata. Profiles are shareable but never indexed:
 * every state carries `noindex`, and unavailable states also `nofollow`.
 */
export function buildPublicProfileHead({ data, t, locale, origin }: PublicProfileHeadInput) {
    const language = normalizeLocale(locale);
    let name: string;
    let description: string;
    let path: string | null = null;
    let robots = 'noindex, nofollow';

    if (data?.status === 'found') {
        name = resolvePublicProfileDisplayName(data.profile, t('fallback.displayName'));
        description = toMetaDescription(data.profile.bio) || t('publicProfile.metaDescription', { name });
        path = buildPath('publicProfile', { username: data.profile.username });
        robots = 'noindex';
    } else if (data?.status === 'private') {
        name = t('publicProfile.privateTitle');
        description = t('publicProfile.privateDescription');
    } else {
        name = t('publicProfile.notFoundTitle');
        description = t('publicProfile.notFoundDescription');
    }

    const title = `${name} · ${APP_NAME}`;
    const ogImage = buildDynamicSiteOgImageUrl(origin, {
        title: name,
        description,
        path: path ?? '/',
        lang: language,
        dir: localeToDir(language),
    });

    return {
        meta: [
            { title },
            { name: 'description', content: description },
            { name: 'robots', content: robots },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:image', content: ogImage },
        ],
    };
}

/**
 * Successful reads (including "not found" and "private") share the short CDN
 * policy. A backend failure is never cached, so a hiccup cannot stick.
 */
export function getPublicProfileCacheHeaders(data: PublicProfilePageData | undefined): Record<string, string> {
    if (!data || data.status === 'unavailable' || (data.status === 'found' && data.tripsFailed)) {
        return { ...privateDocumentCacheHeaders };
    }
    return { ...publicProfileDocumentCacheHeaders };
}
