import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CaretDown, UserCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { NavLink } from '@/app/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useLoginModal } from '../../hooks/useLoginModal';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { buildLoginPathWithNext } from '../../services/authNavigationService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import { activateBootControls } from '../../services/bootInteractionBridge';
import { extractLocaleFromPath } from '../../config/routes';
import { DEFAULT_LOCALE, localeToDir, normalizeLocale } from '../../config/locales';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

const MemberContent = lazy(() => loadLazyComponentWithRecovery('AccountMenu', () =>
    import('./AccountMenu').then(module => ({ default: module.AccountMenuContent }))));

interface AccountEntryProps {
    className?: string;
    bootScope?: string;
    portalContainer?: HTMLElement | null;
    loginSource?: string;
    onLogin?: () => void | Promise<void>;
    isLoginSubmitting?: boolean;
    onAction?: () => void;
    onOpenTripManager?: () => void;
    onPrewarmTripManager?: () => void;
}

/** A permanent public account entry: authentication changes its menu, never its trigger. */
export const AccountEntry: React.FC<AccountEntryProps> = ({ className, bootScope = 'account-entry:header', portalContainer, loginSource = 'navigation_header', onLogin, isLoginSubmitting = false, onAction, onOpenTripManager, onPrewarmTripManager }) => {
    const { t, i18n } = useTranslation('common');
    const { isAuthenticated, isAdmin, access, isLoading } = useAuth();
    const { openLoginModal } = useLoginModal();
    const location = useSafeRouteLocation();
    const [open, setOpen] = useState(false);
    const skipFocusRestore = useRef(false);
    useEffect(() => activateBootControls(bootScope), [bootScope]);
    const locale = extractLocaleFromPath(location.pathname) || normalizeLocale(i18n?.resolvedLanguage || i18n?.language || DEFAULT_LOCALE);
    const close = () => { setOpen(false); onAction?.(); };
    const { loginTarget, nextPath } = buildLoginPathWithNext({ ...location, resolvedLanguage: locale });
    const login = (event: React.MouseEvent<HTMLAnchorElement>) => {
        trackEvent('navigation__login');
        if (isLoginSubmitting) { event.preventDefault(); return; }
        if (event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        // The unresolved account still has a real Login destination. Optional
        // planner owners can preserve their own authentication flow.
        if (!onLogin && isLoading) { close(); return; }
        event.preventDefault();
        skipFocusRestore.current = true;
        close();
        if (onLogin) { void onLogin(); return; }
        openLoginModal({
            source: loginSource,
            nextPath,
            reloadOnSuccess: true,
        });
    };
    const safeActions = <>
        {isAuthenticated ? <DropdownMenuItem asChild>
            <NavLink to="/profile" onClick={() => { close(); trackEvent('navigation__account_menu--profile'); }}
                {...getAnalyticsDebugAttributes('navigation__account_menu--profile')}>{t('nav.account')}</NavLink>
        </DropdownMenuItem> : <DropdownMenuItem asChild disabled={isLoginSubmitting}>
            <NavLink to={loginTarget} onClick={login} {...getAnalyticsDebugAttributes('navigation__login')}>
                {t('nav.login')}
            </NavLink>
        </DropdownMenuItem>}
        <DropdownMenuItem asChild>
            <NavLink to="/trips" onClick={() => { close(); trackEvent('navigation__account_menu--my_trips'); }}
                {...getAnalyticsDebugAttributes('navigation__account_menu--my_trips')}>{t('nav.myTrips')}</NavLink>
        </DropdownMenuItem>
    </>;
    return <DropdownMenu dir={localeToDir(locale)} open={open} onOpenChange={(next) => {
        setOpen(next);
        trackEvent('navigation__account_menu--toggle', { open: next });
    }}>
        <div className={className}>
            <DropdownMenuTrigger asChild>
                <button type="button" data-tf-boot-replay={bootScope} data-tf-boot-scope={bootScope}
                    data-tf-boot-event="pointerdown" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    {...getAnalyticsDebugAttributes('navigation__account_menu--toggle')}>
                    <UserCircle size={22} aria-hidden="true" />
                    <span>{t('nav.account')}</span>
                    <CaretDown size={14} aria-hidden="true" />
                </button>
            </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent portalContainer={portalContainer} align="end" onCloseAutoFocus={(event) => {
            if (!skipFocusRestore.current) return;
            skipFocusRestore.current = false;
            event.preventDefault();
        }} aria-label={t('nav.account')}
            className="z-[2100] w-[min(92vw,320px)] rounded-xl border-border bg-card p-1.5 text-foreground shadow-2xl">
            {isAuthenticated ? <Suspense fallback={safeActions}>
                <MemberContent email={access?.email ?? null} userId={access?.userId ?? null}
                    isAdmin={isAdmin} onOpenTripManager={onOpenTripManager}
                    onPrewarmTripManager={onPrewarmTripManager} onAction={close} />
            </Suspense> : safeActions}
        </DropdownMenuContent>
    </DropdownMenu>;
};
