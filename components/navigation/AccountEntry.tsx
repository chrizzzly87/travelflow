import React, { useEffect, useState } from 'react';
import { UserCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useHydrated } from '../../hooks/useHydrated';
import { useLoginModal } from '../../hooks/useLoginModal';
import { usePresentationLocale } from '../../hooks/usePresentationLocale';
import { useSafeRouteLocation } from '../../hooks/useSafeRouteLocation';
import { resolveAccountLoginNextPath } from '../../services/authNavigationService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { activateBootControls } from '../../services/bootInteractionBridge';
import { localeToDir } from '../../config/locales';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AccountMenuContent } from './AccountMenu';

interface AccountEntryProps {
    className?: string;
    compact?: boolean;
    bootScope?: string;
    portalContainer?: HTMLElement | null;
    loginSource?: string;
    onLogin?: () => void | Promise<void>;
    isLoginSubmitting?: boolean;
    onAction?: () => void;
    onOpenTripManager?: () => void;
    onPrewarmTripManager?: () => void;
}

interface AccountEntryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isAuthenticated: boolean;
    isLoginSubmitting: boolean;
    compact: boolean;
    bootScope: string;
    label: string;
    onGuestLogin: () => void;
}

/** Preserves the same native button while adapting Radix's menu events for guest sign-in. */
const AccountEntryButton = React.forwardRef<HTMLButtonElement, AccountEntryButtonProps>(function AccountEntryButton({
    isAuthenticated, isLoginSubmitting, compact, bootScope, label, onGuestLogin,
    onPointerDown, onKeyDown, onClick, ...buttonProps
}, ref) {
    const hydrated = useHydrated();
    useEffect(() => activateBootControls(bootScope), [bootScope]);
    const popupState: Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-haspopup' | 'aria-controls' | 'aria-expanded'> = hydrated && isAuthenticated ? {
        'aria-haspopup': 'menu', 'aria-controls': buttonProps['aria-controls'], 'aria-expanded': buttonProps['aria-expanded'],
    } : { 'aria-haspopup': 'dialog', 'aria-controls': undefined, 'aria-expanded': undefined };
    const activation = hydrated && isAuthenticated ? 'navigation__account_menu--toggle' : 'navigation__login';
    return <button {...buttonProps} ref={ref} type="button"
        data-tf-boot-replay={bootScope} data-tf-boot-scope={bootScope} data-tf-boot-event="pointerdown"
        {...popupState}
        aria-disabled={!isAuthenticated && isLoginSubmitting ? true : undefined}
        onPointerDown={(event) => {
            if (!isAuthenticated) event.preventDefault();
            else onPointerDown?.(event);
        }}
        onKeyDown={(event) => {
            if (isAuthenticated) { onKeyDown?.(event); return; }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.currentTarget.click();
            } else if (event.key === 'ArrowDown') event.preventDefault();
        }}
        onClick={(event) => {
            if (isAuthenticated) { onClick?.(event); return; }
            event.preventDefault();
            if (!isLoginSubmitting) {
                // Pointerdown is intentionally cancelled for the guest's Radix
                // trigger. Give the dialog a real return-focus target first.
                event.currentTarget.focus({ preventScroll: true });
                onGuestLogin();
            }
        }}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${compact ? 'size-10 justify-center px-0' : 'px-3'}`}
        {...getAnalyticsDebugAttributes(activation)}>
        <UserCircle size={22} aria-hidden="true" />
        <span className={compact ? 'sr-only' : undefined}>{label}</span>
    </button>;
});

/** One permanent entry: guests sign in directly; verified members open their account menu. */
export const AccountEntry: React.FC<AccountEntryProps> = ({ className, compact = false, bootScope = 'account-entry:header', portalContainer, loginSource = 'navigation_header', onLogin, isLoginSubmitting = false, onAction, onOpenTripManager, onPrewarmTripManager }) => {
    const { t, i18n } = useTranslation('common');
    const { isAuthenticated, isAdmin, access } = useAuth();
    const canOpenAccountMenu = isAuthenticated;
    const { openLoginModal } = useLoginModal();
    const location = useSafeRouteLocation();
    const [open, setOpen] = useState(false);
    const locale = usePresentationLocale(location.pathname, i18n?.resolvedLanguage ?? i18n?.language);
    const close = () => { setOpen(false); onAction?.(); };
    const nextPath = resolveAccountLoginNextPath(location);
    const login = () => {
        trackEvent('navigation__login');
        close();
        if (onLogin) { void onLogin(); return; }
        openLoginModal({ source: loginSource, nextPath, reloadOnSuccess: false });
    };
    return <DropdownMenu dir={localeToDir(locale)} open={canOpenAccountMenu && open} onOpenChange={(next) => {
        if (!canOpenAccountMenu) return;
        setOpen(next);
        trackEvent('navigation__account_menu--toggle', { open: next });
    }}>
        <div className={className}>
            <DropdownMenuTrigger asChild>
                <AccountEntryButton isAuthenticated={canOpenAccountMenu} isLoginSubmitting={isLoginSubmitting}
                    compact={compact} bootScope={bootScope} label={t('nav.account')} onGuestLogin={login} />
            </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent portalContainer={portalContainer} align="end" aria-label={t('nav.account')}
            className="z-[2100] w-[min(92vw,320px)] rounded-xl border-border bg-card p-1.5 text-foreground shadow-2xl">
            {canOpenAccountMenu && <AccountMenuContent email={access?.email ?? null} userId={access?.userId ?? null}
                    isAdmin={isAdmin} onOpenTripManager={onOpenTripManager}
                    onPrewarmTripManager={onPrewarmTripManager} onAction={close} />}
        </DropdownMenuContent>
    </DropdownMenu>;
};
