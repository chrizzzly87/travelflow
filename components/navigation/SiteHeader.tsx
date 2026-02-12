import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AirplaneTilt, List, Folder } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { MobileMenu } from './MobileMenu';
import { LanguageSelect } from './LanguageSelect';
import { useHasSavedTrips } from '../../hooks/useHasSavedTrips';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE, localeToDir, localeToHtmlLang, normalizeLocale } from '../../config/locales';
import { AppLanguage } from '../../types';
import { buildLocalizedLocation } from '../../services/localeRoutingService';
import { APP_NAME } from '../../config/appGlobals';

type HeaderVariant = 'solid' | 'glass';

interface SiteHeaderProps {
    variant?: HeaderVariant;
    /** When provided, "My Trips" opens this callback instead of navigating. */
    onMyTripsClick?: () => void;
    /** Hide the "Create Trip" CTA (e.g. when already on the create-trip page). */
    hideCreateTrip?: boolean;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) => {
    const baseClass = 'relative font-semibold text-slate-500 transition-colors hover:text-slate-900 after:pointer-events-none after:absolute after:-bottom-4 after:left-0 after:h-0.5 after:w-full after:origin-center after:scale-x-0 after:rounded-full after:bg-accent-600 after:transition-transform';
    if (isActive) return `${baseClass} text-slate-900 after:scale-x-100`;
    return baseClass;
};

export const SiteHeader: React.FC<SiteHeaderProps> = ({
    variant = 'solid',
    onMyTripsClick,
    hideCreateTrip = false,
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const hasTrips = useHasSavedTrips();
    const location = useLocation();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('common');

    const activeLocale = useMemo<AppLanguage>(() => {
        return extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    }, [location.pathname]);

    const handleLocaleChange = async (nextLocaleRaw: string) => {
        const nextLocale = normalizeLocale(nextLocaleRaw);
        if (nextLocale === activeLocale) return;
        const target = buildLocalizedLocation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            targetLocale: nextLocale,
        });
        try {
            await i18n.changeLanguage(nextLocale);
        } catch {
            // Route locale still drives language as a fallback in App.tsx.
        }
        if (typeof document !== 'undefined') {
            document.documentElement.lang = localeToHtmlLang(nextLocale);
            document.documentElement.dir = localeToDir(nextLocale);
        }
        navigate(target);
        trackEvent('navigation__language_switch', { from: activeLocale, to: nextLocale });
    };

    const handleNavClick = (target: string) => {
        trackEvent(`navigation__${target}`);
    };

    const navDebugAttributes = (target: string) =>
        getAnalyticsDebugAttributes(`navigation__${target}`);

    const isGlass = variant === 'glass';

    const headerClass = isGlass
        ? 'sticky top-0 z-40 border-b border-white/20 bg-white/80 backdrop-blur'
        : 'sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur';

    const loginClass = isGlass
        ? 'hidden sm:inline-flex rounded-lg border border-slate-200/70 bg-white/60 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'
        : 'hidden sm:inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900';

    const burgerClass = isGlass
        ? 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white/60 hover:text-slate-900 lg:hidden'
        : 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden';

    return (
        <>
            <header className={headerClass} style={{ viewTransitionName: 'site-header' }}>
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
                    <NavLink
                        to={buildLocalizedMarketingPath('home', activeLocale)}
                        onClick={() => handleNavClick('brand')}
                        className="flex items-center gap-2"
                        {...navDebugAttributes('brand')}
                    >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                            <AirplaneTilt size={16} weight="duotone" />
                        </span>
                        <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
                    </NavLink>

                    <nav className="hidden items-center gap-4 text-sm lg:flex xl:gap-6">
                        <NavLink to={buildLocalizedMarketingPath('features', activeLocale)} onClick={() => handleNavClick('features')} className={navLinkClass} {...navDebugAttributes('features')}>{t('nav.features')}</NavLink>
                        <NavLink to={buildLocalizedMarketingPath('inspirations', activeLocale)} onClick={() => handleNavClick('inspirations')} className={navLinkClass} {...navDebugAttributes('inspirations')}>{t('nav.inspirations')}</NavLink>
                        <NavLink to={buildLocalizedMarketingPath('updates', activeLocale)} onClick={() => handleNavClick('updates')} className={navLinkClass} {...navDebugAttributes('updates')}>{t('nav.updates')}</NavLink>
                        <NavLink to={buildLocalizedMarketingPath('blog', activeLocale)} onClick={() => handleNavClick('blog')} className={navLinkClass} {...navDebugAttributes('blog')}>{t('nav.blog')}</NavLink>
                        <NavLink to={buildLocalizedMarketingPath('pricing', activeLocale)} onClick={() => handleNavClick('pricing')} className={navLinkClass} {...navDebugAttributes('pricing')}>{t('nav.pricing')}</NavLink>
                    </nav>

                    <div className="flex items-center gap-2">
                        <div className="relative hidden md:block">
                            <LanguageSelect
                                aria-label={t('language.label')}
                                value={activeLocale}
                                onChange={handleLocaleChange}
                                triggerClassName="h-9 rounded-lg border-slate-200 bg-white py-2 pl-3 pr-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                            />
                        </div>
                        <NavLink
                            to={buildLocalizedMarketingPath('login', activeLocale)}
                            onClick={() => handleNavClick('login')}
                            className={loginClass}
                            {...navDebugAttributes('login')}
                        >
                            {t('nav.login')}
                        </NavLink>
                        {hideCreateTrip ? (
                            hasTrips && onMyTripsClick && (
                                <button
                                    onClick={() => {
                                        handleNavClick('my_trips');
                                        onMyTripsClick();
                                    }}
                                    className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                    {...navDebugAttributes('my_trips')}
                                >
                                    <Folder size={15} />
                                    {t('nav.myTrips')}
                                </button>
                            )
                        ) : (
                            <NavLink
                                to={buildPath('createTrip')}
                                onClick={() => handleNavClick('create_trip')}
                                className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                {...navDebugAttributes('create_trip')}
                            >
                                {t('nav.createTrip')}
                            </NavLink>
                        )}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className={burgerClass}
                            aria-label={t('nav.openMenu')}
                            {...getAnalyticsDebugAttributes('mobile_nav__menu--open')}
                        >
                            <List size={22} weight="bold" />
                        </button>
                    </div>
                </div>
            </header>

            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                onMyTripsClick={onMyTripsClick}
            />
        </>
    );
};
