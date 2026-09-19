import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';

import { useTheme } from '../../contexts/theme/useTheme';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { cn } from '../../lib/utils';

interface ThemeToggleProps {
    /** 'bar' is the compact icon button in the desktop header; 'row' is the
     *  full-width labelled control in the mobile menu, where this is the only
     *  theme control the user has. */
    variant?: 'bar' | 'row';
    className?: string;
    analyticsSurface?: string;
}

/**
 * A real forwardRef, not a plain function component. The app renders through
 * preact/compat, where a function component silently never receives `ref` — so
 * anything that may end up behind a Radix `asChild`, a tooltip trigger, or a
 * focus-managing parent has to forward explicitly or the ref lands as undefined
 * and keyboard handling dies quietly.
 */
export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
    ({ variant = 'bar', className, analyticsSurface = 'nav' }, ref) => {
        const { t } = useTranslation('common');
        const { resolvedTheme, toggle } = useTheme();
        const isDark = resolvedTheme === 'dark';

        const label = isDark ? t('nav.themeToLight') : t('nav.themeToDark');

        const handleClick = (): void => {
            trackEvent(`${analyticsSurface}__theme--toggle`, { to: isDark ? 'light' : 'dark' });
            toggle();
        };

        const icon = isDark ? (
            <Sun className="size-4 shrink-0" aria-hidden="true" />
        ) : (
            <Moon className="size-4 shrink-0" aria-hidden="true" />
        );

        if (variant === 'row') {
            return (
                <button
                    ref={ref}
                    type="button"
                    onClick={handleClick}
                    aria-pressed={isDark}
                    className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors',
                        'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
                onClick={handleClick}
                aria-pressed={isDark}
                aria-label={label}
                title={label}
                className={cn(
                    'inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors',
                    'hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
