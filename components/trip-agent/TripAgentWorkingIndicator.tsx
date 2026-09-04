import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThinkingOrb } from 'thinking-orbs';

/**
 * Shown from the moment a request leaves until the first answer text arrives.
 * Tool calls can reach the client fully formed, so the activity row alone left
 * long stretches with nothing on screen.
 */
export const TripAgentWorkingIndicator: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2" role="status">
            <ThinkingOrb state="searching" size={20} aria-label={t('tripAgent.activityWorking')} />
            <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-slate-700">{label}</span>
                {hint && <span className="block truncate text-[11px] text-slate-500">{hint}</span>}
            </span>
        </div>
    );
};
