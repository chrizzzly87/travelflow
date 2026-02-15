import React, { useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { X, AirplaneTilt } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { NAV_ITEMS } from '../../config/navigation';
import { LanguageSelect } from './LanguageSelect';
import { useHasSavedTrips } from '../../hooks/useHasSavedTrips';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath, getNamespacesForMarketingPath, isToolRoute } from '../../config/routes';
import { AppLanguage } from '../../types';
import { applyDocumentLocale, DEFAULT_LOCALE, normalizeLocale } from '../../config/locales';
import { buildLocalizedLocation } from '../../services/localeRoutingService';
import { APP_NAME } from '../../config/appGlobals';
import { preloadLocaleNamespaces } from '../../i18n';
import { useAuth } from '../../hooks/useAuth';
import { useLoginModal } from '../../hooks/useLoginModal';
import { buildPathFromLocationParts } from '../../services/authNavigationService';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onMyTripsClick?: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
        isActive
            ? 'bg-accent-50 text-accent-700'
            : 'text-slate-700 hover:bg-slate-100'
    }`;

const isPlainLeftClick = (event: React.MouseEvent<HTMLAnchorElement>): boolean => (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
);

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, onMyTripsClick }) => {
    const hasTrips = useHasSavedTrips();
    const { t, i18n } = useTranslation('common');
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, isAdmin, logout } = useAuth();
    const { openLoginModal } = useLoginModal();

    const activeLocale = useMemo<AppLanguage>(() => {
        return extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    }, [location.pathname]);

    useEffect(() => {
        if (isOpen) {
            trackEvent('mobile_nav__menu--open');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleNavClick = (target: string) => {
        trackEvent(`mobile_nav__${target}`);
        onClose();
    };

    const handleLoginClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        trackEvent('mobile_nav__login');
        if (!isPlainLeftClick(event)) {
            onClose();
            return;
        }

        event.preventDefault();
        onClose();
        openLoginModal({
            source: 'navigation_mobile',
            nextPath: buildPathFromLocationParts({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            }),
            reloadOnSuccess: true,
        });
    };

    const handleLogout = async () => {
        trackEvent('mobile_nav__logout');
        await logout();
        onClose();
        navigate(buildLocalizedMarketingPath('home', activeLocale));
    };

    const handleLocaleChange = (nextLocaleRaw: string) => {
        const nextLocale = normalizeLocale(nextLocaleRaw);
        if (nextLocale === activeLocale) {
            onClose();
            return;
        }

        onClose();

        if (!isToolRoute(location.pathname)) {
            void preloadLocaleNamespaces(nextLocale, getNamespacesForMarketingPath(location.pathname));
        } else {
            void preloadLocaleNamespaces(nextLocale, ['common']);
        }

        applyDocumentLocale(nextLocale);
        void i18n.changeLanguage(nextLocale);

        const target = buildLocalizedLocation({
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            targetLocale: nextLocale,
        });
        navigate(target);
        trackEvent('mobile_nav__language_switch', { from: activeLocale, to: nextLocale });
    };

    const mobileNavDebugAttributes = (target: string) =>
        getAnalyticsDebugAttributes(`mobile_nav__${target}`);

    const visibleItems = NAV_ITEMS;

    return (
        <>
            <div
                className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                className={`fixed inset-y-0 right-0 z-50 w-[85vw] max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
            >
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-lg shadow-accent-200">
                                <AirplaneTilt size={16} weight="duotone" />
                            </span>
                            <span className="text-lg font-extrabold tracking-tight">{APP_NAME}</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Close menu"
                        >
                            <X size={20} weight="bold" />
                        </button>
                    </div>

                    <div className="border-b border-slate-100 px-4 py-3">
                        <LanguageSelect
                            ariaLabel={t('language.label')}
                            value={activeLocale}
                            onChange={handleLocaleChange}
                            triggerClassName="h-10 w-full rounded-xl border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                            contentAlign="start"
                        />
                    </div>

                    <nav className="flex-1 overflow-y-auto px-3 py-4">
                        <div className="space-y-1">
                            {visibleItems.map((item) => (
                                <NavLink
                                    key={item.id}
                                    to={buildLocalizedMarketingPath(item.routeKey, activeLocale)}
                                    className={navLinkClass}
                                    onClick={() => handleNavClick(item.id)}
                                    {...mobileNavDebugAttributes(item.id)}
                                >
                                    {t(item.labelKey)}
                                </NavLink>
                            ))}
                        </div>
                    </nav>

                    <div className="border-t border-slate-100 p-4 space-y-2">
                        {isAdmin && (
                            <NavLink
                                to="/admin/dashboard"
                                onClick={() => handleNavClick('admin')}
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                {...mobileNavDebugAttributes('admin')}
                            >
                                {t('nav.admin')}
                            </NavLink>
                        )}
                        {onMyTripsClick && hasTrips ? (
                            <button
                                onClick={() => {
                                    handleNavClick('my_trips');
                                    onMyTripsClick();
                                }}
                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                {...mobileNavDebugAttributes('my_trips')}
                            >
                                {t('nav.myTrips')}
                            </button>
                        ) : (
                            <NavLink
                                to={buildPath('createTrip')}
                                onClick={() => handleNavClick('create_trip')}
                                className="block w-full rounded-xl bg-accent-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
                                {...mobileNavDebugAttributes('create_trip')}
                            >
                                {t('nav.createTrip')}
                            </NavLink>
                        )}
                        {isAuthenticated ? (
                            <button
                                type="button"
                                onClick={() => {
                                    void handleLogout();
                                }}
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                {...mobileNavDebugAttributes('logout')}
                            >
                                {t('nav.logout')}
                            </button>
                        ) : (
                            <NavLink
                                to={buildLocalizedMarketingPath('login', activeLocale)}
                                onClick={handleLoginClick}
                                className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-base font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                                {...mobileNavDebugAttributes('login')}
                            >
                                {t('nav.login')}
                            </NavLink>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
