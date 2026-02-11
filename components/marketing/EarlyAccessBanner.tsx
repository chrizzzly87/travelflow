import React, { useState } from 'react';
import { X, Flask } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

const STORAGE_KEY = 'tf_early_access_dismissed';

export const EarlyAccessBanner: React.FC = () => {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        trackEvent('banner__early_access--dismiss');
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // ignore
        }
    };

    return (
        <div className="border-b border-amber-200/60 bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-5 py-2.5 md:px-8">
                <Flask size={16} weight="duotone" className="shrink-0 text-amber-600" />
                <p className="flex-1 text-xs leading-relaxed text-amber-900 sm:text-sm">
                    <span className="font-bold">Early preview</span>
                    <span className="mx-1.5 text-amber-400">—</span>
                    TravelFlow is under active development. Features may change, and some things might not work perfectly yet.
                </p>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="shrink-0 rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
                    aria-label="Dismiss banner"
                    {...getAnalyticsDebugAttributes('banner__early_access--dismiss')}
                >
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
};
