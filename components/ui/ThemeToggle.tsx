import React, { forwardRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../contexts/theme/useTheme';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { cn } from '../../lib/utils';
import { activateBootControls } from '../../services/bootInteractionBridge';

interface ThemeToggleProps {
    /** 'bar' is the compact icon button in the desktop header; 'row' is the
     *  full-width labelled control in the mobile menu, where this is the only
     *  theme control the user has. */
    variant?: 'bar' | 'row';
    className?: string;
    analyticsSurface?: string;
}

/** Ref forwarding supports Radix triggers and focus-managing parents. */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
    ({ variant = 'bar', className, analyticsSurface = 'nav' }, ref) => {
        const { t } = useTranslation('common');
        const { resolvedTheme, toggle } = useTheme();

        const bootScope = `theme:${analyticsSurface}`;
        useEffect(() => {
            return activateBootControls(bootScope);
        }, [bootScope]);

        const isDark = resolvedTheme === 'dark';

        const label = isDark ? t('nav.themeToLight') : t('nav.themeToDark');

        const handleClick = (): void => {
            trackEvent(`${analyticsSurface}__theme--toggle`, { to: resolvedTheme === 'dark' ? 'light' : 'dark' });
            toggle();
        };

        // CSS reads the boot-applied root class before hydration. Both icons
        // have identical geometry, so the visible icon never flips from SSR's
        // default light snapshot while React attaches the handlers.
        const icon = <>
            <Sun className="hidden size-4 shrink-0 dark:block" aria-hidden="true" />
            <Moon className="size-4 shrink-0 dark:hidden" aria-hidden="true" />
        </>;

        if (variant === 'row') {
            return (
                <button
                    ref={ref}
                    type="button"
                    data-tf-boot-replay={bootScope}
                    data-tf-boot-scope={bootScope}
                    onClick={handleClick}
                    aria-pressed={isDark}
                    className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors',
                        'hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'dark:border-border dark:text-foreground dark:hover:bg-secondary',
                        className,
                    )}
                    {...getAnalyticsDebugAttributes(`${analyticsSurface}__theme--toggle`)}
                >
                    <span className="inline-flex items-center gap-2">
                        {icon}
                        <span>{label}</span>
                    </span>
                </button>
            );
        }

        return (
            <button
                ref={ref}
                type="button"
                data-tf-boot-replay={bootScope}
                data-tf-boot-scope={bootScope}
                onClick={handleClick}
                aria-pressed={isDark}
                aria-label={label}
                title={label}
                className={cn(
                    'inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                    'hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground',
                    className,
                )}
                {...getAnalyticsDebugAttributes(`${analyticsSurface}__theme--toggle`)}
            >
                {icon}
            </button>
        );
    },
);

ThemeToggle.displayName = 'ThemeToggle';
