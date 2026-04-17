import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, SuitcaseRolling } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import type { TripWorkspaceMode } from './useTripViewModeState';

interface TripViewWorkspaceNavProps {
    activeMode: TripWorkspaceMode;
    tripId: string;
    onModeChange: (mode: TripWorkspaceMode) => void;
}

const BUTTON_BASE_CLASS_NAME = 'inline-flex min-w-[8.5rem] items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2';

export const TripViewWorkspaceNav: React.FC<TripViewWorkspaceNavProps> = ({
    activeMode,
    tripId,
    onModeChange,
}) => {
    const { t } = useTranslation('common');

    const handleModeChange = (mode: TripWorkspaceMode) => {
        if (mode === activeMode) return;
        trackEvent('trip_view__workspace_mode--change', {
            trip_id: tripId,
            mode,
            source: 'workspace_nav',
        });
        onModeChange(mode);
    };

    return (
        <div className="shrink-0 border-b border-stone-200 bg-[#f4efe7] px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-[1520px] items-center gap-2 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => handleModeChange('planner')}
                    className={`${BUTTON_BASE_CLASS_NAME} ${
                        activeMode === 'planner'
                            ? 'border-stone-900 bg-stone-900 text-stone-50'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                    aria-pressed={activeMode === 'planner'}
                    {...getAnalyticsDebugAttributes('trip_view__workspace_mode--change', {
                        trip_id: tripId,
                        mode: 'planner',
                        source: 'workspace_nav',
                    })}
                >
                    <Compass size={16} weight="duotone" />
                    <span>{t('tripView.workspaceNav.planner')}</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange('prep')}
                    className={`${BUTTON_BASE_CLASS_NAME} ${
                        activeMode === 'prep'
                            ? 'border-accent-700 bg-accent-600 text-white'
                            : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                    aria-pressed={activeMode === 'prep'}
                    {...getAnalyticsDebugAttributes('trip_view__workspace_mode--change', {
                        trip_id: tripId,
                        mode: 'prep',
                        source: 'workspace_nav',
                    })}
                >
                    <SuitcaseRolling size={16} weight="duotone" />
                    <span>{t('tripView.workspaceNav.prep')}</span>
                </button>
            </div>
        </div>
    );
};
