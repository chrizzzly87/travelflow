/**
 * Response caching for server-rendered documents.
 *
 * Public pages render the same HTML for every visitor of a URL: locale comes
 * from the path, i18n is per request, and nothing reads cookies or request
 * headers during SSR. Browsers revalidate every time, while Netlify's CDN keeps
 * the document for an hour and serves a stale copy while refreshing it. A
 * deploy purges the CDN cache, so new releases still appear immediately.
 * If a public page ever reads a cookie or header during SSR, it must add the
 * matching `Netlify-Vary` or opt out here.
 *
 * Every other document stays `no-store` (the root default): account, admin and
 * workspace areas must never be shared between users.
 */
export const privateDocumentCacheHeaders = { 'cache-control': 'no-store' } as const;

export const publicDocumentCacheHeaders = {
    'cache-control': 'public, max-age=0, must-revalidate',
    'netlify-cdn-cache-control': 'public, durable, s-maxage=3600, stale-while-revalidate=86400',
} as const;

/**
 * Public profiles (`/u/$username`) change whenever their owner edits them, so
 * the CDN keeps them for a minute and may serve a stale copy for five more
 * while it refreshes: edits and visibility changes appear within minutes. The
 * page renders the same anonymous view for everyone; owner and admin extras
 * appear only in the browser after hydration.
 */
export const publicProfileDocumentCacheHeaders = {
    'cache-control': 'public, max-age=0, must-revalidate',
    'netlify-cdn-cache-control': 'public, durable, s-maxage=60, stale-while-revalidate=300',
} as const;
