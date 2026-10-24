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
