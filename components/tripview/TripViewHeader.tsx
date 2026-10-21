import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Menu, Pencil, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { AppBrand } from '../navigation/AppBrand';
import { AccountMenu } from '../navigation/AccountMenu';
// Deliberately not lazy, for the same reason SiteHeader keeps it eager: on a
// phone this is the only way out of the planner and into the rest of the app,
// and a chunk fetch meant the first tap opened nothing.
import { MobileMenu } from '../navigation/MobileMenu';
import { Button } from '../ui/button';
import { ThemeToggle } from '../ui/ThemeToggle';

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

// Shared by the header's Share and Log in buttons; colour comes from the Button variant.
const HEADER_BUTTON_CLASS_NAME = 'min-h-10 gap-2 px-3 py-2 shadow-sm active:scale-[0.96] disabled:active:scale-100 dark:shadow-none';

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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const titleStyle = titleViewTransitionName
        ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties)
        : undefined;
    const titleAreaRef = useRef<HTMLButtonElement | null>(null);
    const [titleAreaWidth, setTitleAreaWidth] = useState<number | null>(null);
    const showTripSummary = !isMobile && (titleAreaWidth === null || titleAreaWidth >= 520);

    useEffect(() => {
        if (isMobile || typeof window === 'undefined') return undefined;

        const target = titleAreaRef.current;
        if (!target || typeof ResizeObserver === 'undefined') return undefined;

        const updateSummaryVisibility = () => {
            setTitleAreaWidth(target.getBoundingClientRect().width);
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
        <header className="relative z-[1600] isolate shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-6">
            <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2.5">
                <Link
                    to="/"
                    className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1 transition-opacity hover:opacity-80"
                    title="Go to Homepage"
                    aria-label="Go to Homepage"
                >
                    <AppBrand wordmarkClassName="hidden text-lg font-extrabold tracking-tight text-foreground sm:block" />
                </Link>
                <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" />
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
                    className="group flex min-h-10 min-w-0 flex-1 items-start gap-1 rounded-xl p-1 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 sm:gap-2 sm:px-2"
                    aria-label={titleTooltip}
                    data-tooltip={titleTooltip}
                    data-no-press-scale="true"
                    {...getAnalyticsDebugAttributes('trip_view__trip_info--open', { source: 'header_title' })}
                >
                    <div className="min-w-0 flex-1">
                        <h1
                            className={`${isMobile ? 'line-clamp-1 text-lg' : 'line-clamp-2 text-[1.35rem]'} text-balance break-words font-bold leading-tight text-foreground transition-colors group-hover:text-accent-700`}
                            style={titleStyle}
                        >
                            {tripTitle}
                        </h1>
                        {!isMobile && showTripSummary && (
                            <div className="mt-1 text-xs font-semibold tabular-nums text-accent-600 dark:text-accent-300">
                                {tripSummary}
                            </div>
                        )}
                    </div>
                    <span className="mt-1 hidden shrink-0 items-center gap-1 rounded-full border border-border bg-card/90 px-2 py-1 text-[11px] font-semibold text-muted-foreground opacity-0 shadow-sm transition-[opacity,color,background-color,box-shadow] group-hover:opacity-100 group-focus-visible:opacity-100 md:inline-flex dark:shadow-none">
                        {canManageTripMetadata ? <Pencil size={12} /> : <Info size={12} />}
                        <span className="hidden lg:inline">
                            {canManageTripMetadata ? t('tripView.header.editTitleCta') : t('tripView.header.openDetailsCta')}
                        </span>
                    </span>
                </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                {canShare && (
                    <Button
                        type="button"
                        variant="default"
                        onClick={onShare}
                        disabled={isTripLockedByExpiry}
                        title={isTripLockedByExpiry ? t('tripView.header.shareDisabled') : undefined}
                        className={`${HEADER_BUTTON_CLASS_NAME} ${isMobile ? 'size-10 px-0' : ''}`}
                        aria-label={t('tripView.header.share')}
                        data-tooltip={!isMobile ? t('tripView.header.share') : undefined}
                    >
                        <Share2 size={16} />
                        <span className={isMobile ? 'sr-only' : 'hidden sm:inline'}>{t('tripView.header.share')}</span>
                    </Button>
                )}
                {canUseAuthenticatedSession ? (
                    <AccountMenu
                        email={accountEmail}
                        userId={accountUserId}
                        isAdmin={isAdminSession}
                        compact={isMobile}
                        showLabel={!isMobile}
                        showCaret={!isMobile}
                        labelMode="profile"
                        showRecentTripsSection={false}
                        showCurrentPageSummary={false}
                        onOpenTripManager={onOpenManager}
                        triggerClassName={isMobile
                            ? 'size-10 justify-center px-0'
                            : 'gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:border-border hover:bg-secondary hover:text-foreground'}
                    />
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onHeaderAuthAction}
                        disabled={isHeaderAuthSubmitting}
                        className={`${HEADER_BUTTON_CLASS_NAME} bg-card text-muted-foreground hover:bg-secondary dark:bg-card dark:text-foreground dark:hover:bg-secondary`}
                        aria-label={t('nav.login')}
                    >
                        {t('nav.login')}
                    </Button>
                )}
                {/* Desktop only, like SiteHeader: below lg the burger's menu carries the toggle. */}
                <ThemeToggle analyticsSurface="trip_view" className="hidden size-10 lg:inline-flex" />
                {/*
                  * Last in the row, which is where SiteHeader puts it too: the
                  * burger is the same control on every screen, and a thumb
                  * reaching for it should not have to find it in a different
                  * place depending on which page is open.
                  *
                  * Also the planner's only way into site navigation — without it
                  * the trip page is a dead end on a phone, since the logo goes
                  * home and nothing else in the header leads anywhere.
                  */}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => setIsMobileMenuOpen(true)}
                    data-testid="trip-header-menu"
                    className="text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden dark:text-foreground dark:hover:bg-secondary"
                    aria-label={t('nav.openMenu')}
                    {...getAnalyticsDebugAttributes('mobile_nav__menu--open', { surface: 'trip_header' })}
                >
                    <Menu size={20} />
                </Button>
            </div>
            </div>
            {isMobileMenuOpen && (
                <MobileMenu
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onMyTripsClick={onOpenManager}
                />
            )}
        </header>
    );
};
