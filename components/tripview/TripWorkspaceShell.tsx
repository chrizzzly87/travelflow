import React from 'react';
import { CalendarDays, LayoutDashboard, PanelLeftClose } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAnalyticsDebugAttributes } from '../../services/analyticsService';
import type { TripWorkspacePresentation } from './tripWorkspacePresentation';

export type ModularTripWorkspaceView = 'overview' | 'schedule';

interface TripWorkspaceShellProps {
    presentation: TripWorkspacePresentation;
    onViewChange: (view: TripWorkspacePresentation) => void;
    onExitToClassic: () => void;
    children: React.ReactNode;
    scheduleContent: React.ReactNode;
}

const NAV_ITEM_CLASS_NAME = 'group flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-start text-sm font-semibold transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 md:size-11 md:justify-center md:px-0 xl:size-auto xl:w-full xl:justify-start xl:px-3';

export const TripWorkspaceShell: React.FC<TripWorkspaceShellProps> = ({
    presentation,
    onViewChange,
    onExitToClassic,
    children,
    scheduleContent,
}) => {
    const { t } = useTranslation('common');
    if (presentation === 'classic') return <>{children}</>;

    const renderNavItem = (
        view: ModularTripWorkspaceView,
        icon: React.ReactNode,
        label: string,
    ) => {
        const isActive = presentation === view;
        return (
            <button
                type="button"
                onClick={() => onViewChange(view)}
                aria-current={isActive ? 'page' : undefined}
                className={`${NAV_ITEM_CLASS_NAME} ${
                    isActive
                        ? 'border-accent-200 bg-accent-50 text-accent-800 shadow-sm'
                        : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950'
                }`}
                {...getAnalyticsDebugAttributes(`trip_view__workspace_view--${view}`, { surface: 'workspace_nav' })}
            >
                <span className="shrink-0" aria-hidden="true">{icon}</span>
                <span className="md:sr-only xl:not-sr-only">{label}</span>
            </button>
        );
    };

    return (
        <section
            data-testid="trip-workspace-shell"
            className="size-full min-h-0 bg-slate-100 p-2 sm:p-3"
            aria-label={t('tripView.workspace.shellLabel')}
        >
            <div className="flex size-full min-h-0 flex-col gap-2 md:flex-row md:gap-3">
                <aside className="flex shrink-0 flex-row items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm md:w-[64px] md:flex-col xl:w-[216px]">
                    <div className="hidden w-full px-2 pb-2 pt-1 xl:block">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-600">
                            {t('tripView.workspace.eyebrow')}
                        </p>
                        <h2 className="mt-1 text-base font-bold text-slate-950">
                            {t('tripView.workspace.title')}
                        </h2>
                    </div>

                    <nav
                        className="flex min-w-0 flex-1 items-center gap-1 md:w-full md:flex-col md:items-stretch"
                        aria-label={t('tripView.workspace.navigationLabel')}
                    >
                        {renderNavItem('overview', <LayoutDashboard size={18} />, t('tripView.workspace.views.overview'))}
                        {renderNavItem('schedule', <CalendarDays size={18} />, t('tripView.workspace.views.schedule'))}
                    </nav>

                    <button
                        type="button"
                        onClick={onExitToClassic}
                        className={`${NAV_ITEM_CLASS_NAME} shrink-0 text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-950 md:mt-auto`}
                        {...getAnalyticsDebugAttributes('trip_view__workspace--exit', { surface: 'workspace_nav' })}
                    >
                        <PanelLeftClose size={18} aria-hidden="true" />
                        <span className="md:sr-only xl:not-sr-only">{t('tripView.workspace.classicAction')}</span>
                    </button>
                </aside>

                <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div
                        data-testid="trip-workspace-overview"
                        aria-hidden={presentation !== 'overview'}
                        className={presentation === 'overview'
                            ? 'relative size-full'
                            : 'pointer-events-none invisible absolute inset-0 size-full'}
                    >
                        {children}
                    </div>
                    <div
                        data-testid="trip-workspace-schedule"
                        aria-hidden={presentation !== 'schedule'}
                        className={presentation === 'schedule'
                            ? 'relative size-full'
                            : 'pointer-events-none invisible absolute inset-0 size-full'}
                    >
                        {scheduleContent}
                    </div>
                </div>
            </div>
        </section>
    );
};
