import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { NavLink } from '@/app/navigation';
import { List, SpinnerGap as Loader2 } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { LanguageSelect } from './LanguageSelect';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedCreateTripPath, buildLocalizedMarketingPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';
import { AppLanguage } from '../../types';
import { useLocaleNavigation } from '../../hooks/useLocaleNavigation';
import { useAuth } from '../../hooks/useAuth';
import { useLoginModal } from '../../hooks/useLoginModal';
import { buildPathFromLocationParts } from '../../services/authNavigationService';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { AppBrand } from './AppBrand';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { BOOT_INTENT_MOBILE_MENU, consumeBootIntent } from '../../services/bootInteractionBridge';
// Deliberately NOT lazy. The burger is the only way into navigation on a phone,
// and a separate chunk meant the first tap opened nothing until a round trip
// finished (Suspense rendered null meanwhile). MobileMenu adds ~11KB to the
// header chunk, which is far cheaper than a network hop on a tap.
import { MobileMenu } from './MobileMenu';
import { ThemeToggle } from '../ui/ThemeToggle';

const lazyWithRecovery = <TModule extends { default: React.ComponentType<any> },>(
    moduleKey: string,
    importer: () => Promise<TModule>
) => lazy(() => loadLazyComponentWithRecovery(moduleKey, importer));

const AccountMenu = lazyWithRecovery('AccountMenu', () =>
    import('./AccountMenu').then((module) => ({ default: module.AccountMenu }))
);

type HeaderVariant = 'solid' | 'glass';

interface SiteHeaderProps {
    variant?: HeaderVariant;
    /** When provided, "My Trips" opens this callback instead of navigating. */
    onMyTripsClick?: () => void;
    /** Prewarm callback for explicit My Trips intent. */
    onMyTripsIntent?: () => void;
    /** Hide the "Create Trip" CTA (e.g. when already on the create-trip page). */
    hideCreateTrip?: boolean;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = 'relative inline-flex min-h-10 items-center font-semibold text-muted-foreground transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground after:pointer-events-none after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:rounded-full after:bg-accent-600 after:transition-transform';
    if (isActive) return `${baseClass} text-foreground dark:text-foreground after:scale-x-100`;
    return baseClass;
};

const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>): boolean => (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
);

export const SiteHeader: React.FC<SiteHeaderProps> = ({
    variant = 'solid',
    onMyTripsClick,
    onMyTripsIntent,
    hideCreateTrip = false,
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Replay an intent captured before the bundle once the menu can mount.
    useEffect(() => {
        if (consumeBootIntent(BOOT_INTENT_MOBILE_MENU)) setIsMobileMenuOpen(true);
    }, []);
    const [pendingLocale, setPendingLocale] = useState<AppLanguage | null>(null);
    const routeLocation = useSafeRouteLocation();
    const changeLocale = useLocaleNavigation();
    const { t, i18n } = useTranslation('common');
    const { isAuthenticated, isAdmin, access, isLoading } = useAuth();
    const { openLoginModal } = useLoginModal();

    const activeLocale = useMemo<AppLanguage>(() => {
        const routeLocale = extractLocaleFromPath(routeLocation.pathname);
        if (routeLocale) return routeLocale;
        return normalizeLocale(i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LOCALE);
    }, [i18n.language, i18n.resolvedLanguage, routeLocation.pathname]);
    const selectedLocale = pendingLocale ?? activeLocale;

    useEffect(() => {
        if (!pendingLocale) return;
        if (pendingLocale === activeLocale) {
            setPendingLocale(null);
            return;
        }
        const timeoutId = window.setTimeout(() => {
            setPendingLocale(null);
        }, 1500);
        return () => window.clearTimeout(timeoutId);
    }, [activeLocale, pendingLocale]);

    const handleLocaleChange = (nextLocaleRaw: string) => {
        const nextLocale = normalizeLocale(nextLocaleRaw);
        if (nextLocale === activeLocale) {
            setPendingLocale(null);
            return;
        }

        setPendingLocale(nextLocale);

        void changeLocale(nextLocale);
        trackEvent('navigation__language_switch', { from: activeLocale, to: nextLocale });
    };

    const handleNavClick = (target: string) => {
        trackEvent(`navigation__${target}`);
    };

    const handleLoginClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        handleNavClick('login');
        if (isLoading) return;
        if (!isPlainLeftClick(event)) return;

        event.preventDefault();
        openLoginModal({
            source: 'navigation_header',
            nextPath: buildPathFromLocationParts({
                pathname: routeLocation.pathname,
                search: routeLocation.search,
                hash: routeLocation.hash,
            }),
            reloadOnSuccess: true,
        });
    };

    const navDebugAttributes = (target: string) =>
        getAnalyticsDebugAttributes(`navigation__${target}`);


    const isGlass = variant === 'glass';

    const headerClass = isGlass
        ? 'sticky top-0 z-[1600] isolate border-b border-white/20 bg-card/80 backdrop-blur dark:border-white/10 dark:bg-background/80'
        : 'sticky top-0 z-[1600] isolate border-b border-border/70 bg-card/90 backdrop-blur dark:border-border dark:bg-background/90';

    const loginClass = isGlass
        ? 'hidden min-h-10 items-center rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-sm font-medium text-muted-foreground transition-[scale,border-color,color] duration-150 ease-out hover:border-border hover:text-foreground active:scale-[0.96] sm:inline-flex dark:border-border dark:bg-card/60 dark:text-muted-foreground dark:hover:border-border dark:hover:text-foreground'
        : 'hidden min-h-10 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-[scale,border-color,color] duration-150 ease-out hover:border-border hover:text-foreground active:scale-[0.96] sm:inline-flex dark:border-border dark:text-muted-foreground dark:hover:border-border dark:hover:text-foreground';

    const burgerClass = isGlass
        ? 'flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground lg:hidden dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground'
        : 'flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground';

    return (
        <>
            <header
                className={headerClass}
                style={{ viewTransitionName: 'site-header' }}
            >
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
                    <NavLink
                        to={buildLocalizedMarketingPath('home', activeLocale)}
                        onClick={() => handleNavClick('brand')}
                        className="flex min-h-10 items-center gap-2"
                        {...navDebugAttributes('brand')}
                    >
                        <AppBrand />
                    </NavLink>

                    <nav className="hidden items-center gap-4 text-sm lg:flex xl:gap-6">
                        {(['features', 'inspirations', 'updates', 'blog', 'pricing'] as const).map((routeKey) => {
                            const path = buildLocalizedMarketingPath(routeKey, activeLocale);
                            return (
                                <NavLink
                                    key={routeKey}
                                    to={path}
                                    onClick={() => handleNavClick(routeKey)}
                                    className={navLinkClass}
                                    {...navDebugAttributes(routeKey)}
                                >
                                    {t(`nav.${routeKey}`)}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2">
                        <div className="relative hidden md:block">
                            <LanguageSelect
                                ariaLabel={t('language.label')}
                                value={selectedLocale}
                                onChange={handleLocaleChange}
                                triggerClassName="h-9 rounded-lg border-border bg-card py-2 pl-3 pr-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-border dark:border-border dark:bg-card dark:text-foreground dark:shadow-none"
                            />
                        </div>
                        {isAuthenticated ? (
                            <Suspense
                                fallback={(
                                    <span
                                        className="hidden size-10 rounded-full border border-border bg-secondary lg:inline-flex"
                                        aria-hidden="true"
                                    />
                                )}
                            >
                                <AccountMenu
                                    email={access?.email || null}
                                    userId={access?.userId || null}
                                    isAdmin={isAdmin}
                                    labelMode="profile"
                                    onOpenTripManager={onMyTripsClick}
                                    onPrewarmTripManager={onMyTripsIntent}
                                    className="hidden lg:block"
                                />
                            </Suspense>
                        ) : isLoading ? (
                            <NavLink
                                to={buildLocalizedMarketingPath('login', activeLocale)}
                                onClick={handleLoginClick}
                                className={`${loginClass} items-center gap-2 opacity-70`}
                                aria-busy="true"
                                {...navDebugAttributes('login')}
                            >
                                <Loader2 size={14} className="animate-spin" />
                                {t('nav.login')}
                            </NavLink>
                        ) : (
                            <NavLink
                                to={buildLocalizedMarketingPath('login', activeLocale)}
                                onClick={handleLoginClick}
                                className={loginClass}
                                {...navDebugAttributes('login')}
                            >
                                {t('nav.login')}
                            </NavLink>
                        )}
                        {!hideCreateTrip && (
                            <NavLink
                                to={buildLocalizedCreateTripPath(activeLocale)}
                                onClick={() => handleNavClick('create_trip')}



                                className="inline-flex min-h-10 items-center rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-[scale,background-color,box-shadow] duration-150 ease-out hover:bg-accent-700 active:scale-[0.96] dark:bg-accent-400 dark:text-background dark:shadow-none dark:hover:bg-accent-300"
                                {...navDebugAttributes('create_trip')}
                            >
                                {t('nav.createTrip')}
                            </NavLink>
                        )}
                        <ThemeToggle analyticsSurface="nav" className="hidden lg:inline-flex" />
                        <button type="button"
                            onClick={() => setIsMobileMenuOpen(true)}
                            data-tf-boot-intent={BOOT_INTENT_MOBILE_MENU}
                            className={burgerClass}
                            aria-label={t('nav.openMenu')}
                            {...getAnalyticsDebugAttributes('mobile_nav__menu--open')}
                        >
                            <List size={22} weight="bold" />
                        </button>
                    </div>
                </div>
            </header>

            {isMobileMenuOpen && (
                <MobileMenu
                    isOpen={isMobileMenuOpen}
                    onClose={() => setIsMobileMenuOpen(false)}
                    onMyTripsClick={onMyTripsClick}
                    onMyTripsIntent={onMyTripsIntent}
                />
            )}
        </>
    );
};
