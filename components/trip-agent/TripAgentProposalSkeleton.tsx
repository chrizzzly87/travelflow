import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThinkingOrb } from 'thinking-orbs';

/**
 * Stand-in for the proposal card while the run is still assembling changes.
 * Building a change set takes several seconds, and an empty conversation in
 * that window reads as a hang.
 */
export const TripAgentProposalSkeleton: React.FC = () => {
    const { t } = useTranslation('common');

    return (
        <section
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            aria-label={t('tripAgent.preparingProposal')}
            aria-busy="true"
        >
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                <ThinkingOrb state="solving" size={20} aria-label={t('tripAgent.preparingProposal')} />
                <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t('tripAgent.preparingProposal')}</p>
                    <p className="text-xs text-slate-500">{t('tripAgent.preparingProposalHint')}</p>
                </div>
            </div>
            <div className="space-y-2 p-4" aria-hidden="true">
                {[0, 1, 2].map((row) => (
                    <div key={row} className="flex items-start gap-2.5 rounded-xl border border-slate-100 p-3">
                        <span className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-slate-200" />
                        <span className="min-w-0 flex-1 space-y-1.5">
                            <span className="block h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                            <span className="block h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
};
