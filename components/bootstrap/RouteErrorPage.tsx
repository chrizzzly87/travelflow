import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { ArrowClockwise, House } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { DEFAULT_LOCALE } from '../../config/locales';
import { buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const RETRY_EVENT = 'route_error__button--retry';
const HOME_EVENT = 'route_error__link--home';

/** A deploy replaces hashed chunks; an open tab can only recover with a fresh document. */
export const isStaleChunkError = (error: unknown) =>
    error instanceof Error && /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i.test(error.message);

/**
 * Default boundary for any route without its own. The raw error never reaches
 * the page: visitors get an authored sentence, a retry and a way home; the
 * error name is the only diagnostic sent to analytics.
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
    const { t } = useTranslation('common');
    const router = useRouter();
    const pathname = router.state.location.pathname;
    const locale = extractLocaleFromPath(pathname) ?? DEFAULT_LOCALE;
    const staleChunk = isStaleChunkError(error);

    useEffect(() => {
        trackEvent('route_error__view', { kind: staleChunk ? 'stale_chunk' : 'render', name: error instanceof Error ? error.name : 'unknown' });
    }, [error, staleChunk]);

    const retry = () => {
        trackEvent(RETRY_EVENT, { kind: staleChunk ? 'stale_chunk' : 'render' });
        if (staleChunk) {
            window.location.reload();
            return;
        }
        reset();
        void router.invalidate();
    };

    return (
        <main role="alert" className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-16 text-center">
            <h1 className="max-w-[22ch] text-balance text-2xl font-semibold text-foreground md:text-4xl" style={{ fontFamily: 'var(--tf-font-heading)' }}>
                {t('routeError.title')}
            </h1>
            <p className="mt-4 max-w-md text-pretty text-sm text-muted-foreground md:text-base">{t('routeError.body')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" icon={<ArrowClockwise weight="bold" />} onClick={retry} {...getAnalyticsDebugAttributes(RETRY_EVENT)}>
                    {t('routeError.retry')}
                </Button>
                {/* A plain anchor: if routing itself failed, a full document load still gets home. */}
                <Button asChild size="lg" variant="outline">
                    <a href={buildLocalizedMarketingPath('home', locale)} onClick={() => trackEvent(HOME_EVENT)} {...getAnalyticsDebugAttributes(HOME_EVENT)}>
                        <House weight="bold" />
                        {t('routeError.home')}
                    </a>
                </Button>
            </div>
        </main>
    );
}
