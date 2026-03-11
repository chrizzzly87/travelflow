import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Info, Pencil, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { AppBrand } from '../navigation/AppBrand';
import { AccountMenu } from '../navigation/AccountMenu';

interface TripViewHeaderProps {
    isMobile: boolean;
    tripTitle: string;
    tripSummary: string;
    titleViewTransitionName: string | null;
    canManageTripMetadata: boolean;
    onHeaderAuthAction: () => void;
    isHeaderAuthSubmitting: boolean;
    canUseAuthenticatedSession: boolean;
    accountEmail: string | null;
    accountUserId: string | null;
    isAdminSession: boolean;
    onOpenTripInfo: () => void;
    onPrewarmTripInfo: () => void;
    onOpenManager: () => void;
    canShare: boolean;
    onShare: () => void;
    isTripLockedByExpiry: boolean;
}

export const TripViewHeader: React.FC<TripViewHeaderProps> = ({
    isMobile,
    tripTitle,
    tripSummary,
    titleViewTransitionName,
    canManageTripMetadata,
    onHeaderAuthAction,
    isHeaderAuthSubmitting,
    canUseAuthenticatedSession,
    accountEmail,
    accountUserId,
    isAdminSession,
    onOpenTripInfo,
    onPrewarmTripInfo,
    onOpenManager,
    canShare,
    onShare,
    isTripLockedByExpiry,
}) => {
    const { t } = useTranslation('common');
    const headerSecondaryButtonClassName = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
    const headerPrimaryButtonClassName = 'inline-flex items-center gap-2 rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
    const titleStyle = titleViewTransitionName
        ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties)
        : undefined;
    const titleAreaRef = useRef<HTMLButtonElement | null>(null);
    const [showTripSummary, setShowTripSummary] = useState(false);

    useEffect(() => {
        if (isMobile || typeof window === 'undefined') {
            setShowTripSummary(false);
            return;
        }

        const target = titleAreaRef.current;
        if (!target || typeof ResizeObserver === 'undefined') {
            setShowTripSummary(true);
            return;
        }

        const updateSummaryVisibility = () => {
            const nextWidth = target.getBoundingClientRect().width;
            setShowTripSummary(nextWidth >= 520);
        };

        updateSummaryVisibility();
        const observer = new ResizeObserver(updateSummaryVisibility);
        observer.observe(target);
        return () => observer.disconnect();
    }, [isMobile, tripTitle, tripSummary]);

    const titleTooltip = canManageTripMetadata
        ? t('tripView.header.titleTooltipEditable')
        : t('tripView.header.titleTooltipReadonly');

    return (
        <header className="border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6 z-30 shrink-0">
            <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Link
                    to="/"
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                    title="Go to Homepage"
                    aria-label="Go to Homepage"
                >
                    <AppBrand wordmarkClassName="hidden text-lg font-extrabold tracking-tight text-slate-900 sm:block" />
                </Link>
                <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />
                <button
                    ref={titleAreaRef}
                    type="button"
                    onClick={() => {
                        trackEvent('trip_view__trip_info--open', { source: 'header_title' });
                        onOpenTripInfo();
                    }}
                    onMouseEnter={onPrewarmTripInfo}
                    onFocus={onPrewarmTripInfo}
                    onTouchStart={onPrewarmTripInfo}
                    className="group flex min-w-0 flex-1 items-start gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    aria-label={titleTooltip}
                    data-tooltip={titleTooltip}
                    {...getAnalyticsDebugAttributes('trip_view__trip_info--open', { source: 'header_title' })}
                >
                    <div className="min-w-0 flex-1">
                        <h1
                            className={`${isMobile ? 'line-clamp-1 text-lg' : 'line-clamp-2 text-[1.35rem]'} break-words font-bold leading-tight text-gray-900 transition-colors group-hover:text-accent-700`}
                            style={titleStyle}
                        >
                            {tripTitle}
                        </h1>
                        {!isMobile && showTripSummary && (
                            <div className="mt-1 text-xs font-semibold text-accent-600">
                                {tripSummary}
                            </div>
                        )}
                    </div>
                    <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-500 opacity-0 shadow-sm transition-all group-hover:opacity-100 group-focus-visible:opacity-100">
                        {canManageTripMetadata ? <Pencil size={12} /> : <Info size={12} />}
                        <span className="hidden lg:inline">
                            {canManageTripMetadata ? t('tripView.header.editTitleCta') : t('tripView.header.openDetailsCta')}
                        </span>
                    </span>
                </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        trackEvent('navigation__my_trips', { source: 'trip_view_header' });
                        onOpenManager();
                    }}
                    className={`${headerSecondaryButtonClassName} ${isMobile ? 'h-10 w-10 justify-center px-0' : ''}`}
                    aria-label={t('tripView.header.trips')}
                    data-tooltip={t('tripView.header.tripsTooltip')}
                    {...getAnalyticsDebugAttributes('navigation__my_trips', { source: 'trip_view_header' })}
                >
                    <Folder size={16} />
                    {!isMobile && <span>{t('tripView.header.trips')}</span>}
                    {isMobile && <span className="sr-only">{t('tripView.header.trips')}</span>}
                </button>
                {canShare && (
                    <button
                        type="button"
                        onClick={onShare}
                        disabled={isTripLockedByExpiry}
                        title={isTripLockedByExpiry ? t('tripView.header.shareDisabled') : undefined}
                        className={`${headerPrimaryButtonClassName} ${isMobile ? 'h-10 w-10 justify-center px-0' : ''} ${
                            isTripLockedByExpiry
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : ''
                        }`}
                        aria-label={t('tripView.header.share')}
                        data-tooltip={!isMobile ? t('tripView.header.share') : undefined}
                    >
                        <Share2 size={16} />
                        <span className={isMobile ? 'sr-only' : 'hidden sm:inline'}>{t('tripView.header.share')}</span>
                    </button>
                )}
                {canUseAuthenticatedSession ? (
                    <AccountMenu
                        email={accountEmail}
                        userId={accountUserId}
                        isAdmin={isAdminSession}
                        labelMode="profile"
                        showRecentTripsSection={false}
                        showCurrentPageSummary={false}
                        triggerClassName="gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={onHeaderAuthAction}
                        disabled={isHeaderAuthSubmitting}
                        className={headerSecondaryButtonClassName}
                        aria-label={t('nav.login')}
                    >
                        {t('nav.login')}
                    </button>
                )}
            </div>
            </div>
        </header>
    );
};
