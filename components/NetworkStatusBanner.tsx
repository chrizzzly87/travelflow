import React from 'react';
import { useTranslation } from 'react-i18next';

interface NetworkStatusBannerProps {
    isOnline: boolean;
    isProbePending: boolean;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
    isOnline,
    isProbePending,
}) => {
    const { t } = useTranslation('common');

    if (isOnline) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[22000] flex justify-center px-4 pt-3">
            <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto w-full max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg"
            >
                <p className="text-sm font-semibold">{t('networkStatus.offlineTitle')}</p>
                <p className="mt-1 text-sm">{t('networkStatus.offlineDescription')}</p>
                {isProbePending && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                        {t('networkStatus.offlineChecking')}
                    </p>
                )}
            </div>
        </div>
    );
};
