import React, { useState, useEffect } from 'react';
import { X, Flask } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';

const STORAGE_KEY = 'tf_early_access_dismissed';

export const EarlyAccessBanner: React.FC = () => {
    const { t } = useTranslation('common');
    const [dismissed, setDismissed] = useState(() => {
        try {
            return readLocalStorageItem(STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const isTestEnv = typeof process !== 'undefined' &&
            (process.env.NODE_ENV === 'test' || typeof process.env.VITEST !== 'undefined');

        if (isTestEnv) {
            setShouldRender(true);
            return;
        }

        let timer: NodeJS.Timeout;
        const triggerBanner = () => {
            setShouldRender(true);
            cleanup();
        };

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            window.removeEventListener('scroll', triggerBanner);
            window.removeEventListener('mousemove', triggerBanner);
            window.removeEventListener('touchstart', triggerBanner);
            window.removeEventListener('keydown', triggerBanner);
        };

        // Wait 10 seconds before rendering the banner to allow the main page elements to paint first
        timer = setTimeout(triggerBanner, 10000);

        // Also trigger rendering immediately on first user interaction
        window.addEventListener('scroll', triggerBanner, { passive: true });
        window.addEventListener('mousemove', triggerBanner, { passive: true });
        window.addEventListener('touchstart', triggerBanner, { passive: true });
        window.addEventListener('keydown', triggerBanner, { passive: true });

        return cleanup;
    }, []);

    if (dismissed || !shouldRender) return null;

    const handleDismiss = () => {
        setDismissed(true);
        trackEvent('banner__early_access--dismiss');
        try {
            writeLocalStorageItem(STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    };

    return (
        <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-2.5 md:px-8">
                <Flask size={16} weight="duotone" className="shrink-0 text-amber-600" />
                <p className="flex-1 text-xs leading-relaxed text-amber-900 sm:text-sm">
                    <span className="font-bold">{t('earlyAccess.tag')}</span>
                    <span className="mx-1.5 text-amber-400">-</span>
                    {t('earlyAccess.message')}
                </p>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="shrink-0 rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
                    aria-label={t('earlyAccess.dismiss')}
                    {...getAnalyticsDebugAttributes('banner__early_access--dismiss')}
                >
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
};
