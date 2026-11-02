import { extractLocaleFromPath } from '../../config/routes';

type DocumentHint = { rel: string; href: string; as?: string; type?: string; crossOrigin?: 'anonymous' };
const font = (href: string): DocumentHint => ({ rel: 'preload', href: `/fonts/${href}.woff2`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });

/** Declarative native head hints; public documents do not speculate on planner hosts. */
export function getDocumentHints(pathname: string): DocumentHint[] {
    const locale = extractLocaleFromPath(pathname);
    const hints = [font('bricolage-grotesque/bricolage-grotesque-latin'), font('space-grotesk/space-grotesk-latin')];
    if (locale === 'ru') hints.push(font('noto-fallback/noto-sans-cyrillic'), font('noto-fallback/noto-sans-cyrillic-ext'));
    if (locale === 'fa' || locale === 'ur') hints.push(...[400, 700, 800].map(weight => font(`vazirmatn/vazirmatn-arabic-${weight}-normal`)));
    if (locale === 'pl') hints.push(font('bricolage-grotesque/bricolage-grotesque-latin-ext'), font('space-grotesk/space-grotesk-latin-ext'));
    if (/^\/(?:trip|s|example)\//.test(pathname)) hints.push(
        { rel: 'preconnect', href: 'https://api.mapbox.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://maps.googleapis.com' },
        { rel: 'preconnect', href: 'https://maps.gstatic.com' },
    );
    return hints;
}
