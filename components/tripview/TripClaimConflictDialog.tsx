import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, WarningCircle } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { useLoginModal } from '../../hooks/useLoginModal';
import type { ITrip } from '../../types';
import { buildCreateSimilarTripPath } from '../../services/tripClaimConflictService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

export interface TripClaimConflictDialogProps {
    tripId: string;
    claimConflictTrip: Pick<ITrip, 'title' | 'aiMeta'>;
    claimConflictPathname: string;
    claimConflictShowLoginCta: boolean;
    onClaimConflictLogin?: () => void;
    loadingDestinationSummary: string;
    tripDateRange: string;
    tripSpanCompactLabel: string;
}

export const TripClaimConflictDialog: React.FC<TripClaimConflictDialogProps> = ({
    tripId, claimConflictTrip, claimConflictPathname, claimConflictShowLoginCta,
    onClaimConflictLogin, loadingDestinationSummary, tripDateRange, tripSpanCompactLabel,
}) => {
    const { t } = useTranslation('common');
    const { isLoginModalOpen } = useLoginModal();
    const primaryActionRef = React.useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
    // Recovery owns its complete destination draft before any action is displayed.
    const claimConflictCreateSimilarPath = React.useMemo(() => buildCreateSimilarTripPath({
        trip: claimConflictTrip,
        pathname: claimConflictPathname,
    }), [claimConflictTrip, claimConflictPathname]);

    return (
        // The login modal owns a separate focus boundary. Suspend this one while it
        // is open, then restore recovery and its original primary action on close.
        <Dialog open={!isLoginModalOpen}>
            <DialogContent size="md" className="rounded-2xl"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    primaryActionRef.current?.focus();
                }}
                onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
                <div className="overflow-y-auto">
                    <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-700 dark:text-accent-200">
                                        {t('tripView.claimConflict.eyebrow')}
                                    </p>
                                    <DialogTitle className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-foreground">
                                        {t('tripView.claimConflict.title')}
                                    </DialogTitle>
                                </div>
                                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-200 bg-accent-50 text-accent-700 dark:bg-accent-400/12 dark:text-accent-200 dark:border-accent-400/30">
                                    <WarningCircle size={20} weight="duotone" />
                                </span>
                            </div>

                            <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
                                {claimConflictShowLoginCta
                                    ? t('tripView.claimConflict.descriptionLoggedOut')
                                    : t('tripView.claimConflict.descriptionLoggedIn')}
                            </DialogDescription>

                            <div className="mt-4 rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-muted-foreground">
                                {loadingDestinationSummary} • {tripDateRange} • {tripSpanCompactLabel}
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {claimConflictShowLoginCta && (
                                    <Button
                                        ref={(node) => { primaryActionRef.current = node; }}
                                        type="button"
                                        variant="default"
                                        size="lg"
                                        onClick={() => {
                                            trackEvent('trip_generation__claim_conflict_modal--login', {
                                                trip_id: tripId,
                                                source: 'trip_claim_conflict_modal',
                                            });
                                            onClaimConflictLogin?.();
                                        }}
                                        className="h-11 rounded-xl px-4 font-semibold"
                                        {...getAnalyticsDebugAttributes('trip_generation__claim_conflict_modal--login', {
                                            trip_id: tripId,
                                            source: 'trip_claim_conflict_modal',
                                        })}
                                    >
                                        {t('tripView.claimConflict.loginCta')}
                                    </Button>
                                )}
                                <Link
                                    ref={(node) => {
                                        if (!claimConflictShowLoginCta) primaryActionRef.current = node;
                                    }}
                                    to={claimConflictCreateSimilarPath}
                                    onClick={() => {
                                        trackEvent('trip_generation__claim_conflict_modal--create_similar', {
                                            trip_id: tripId,
                                            source: 'trip_claim_conflict_modal',
                                        });
                                    }}
                                    className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 ${
                                        claimConflictShowLoginCta
                                            ? 'border border-border bg-card text-foreground hover:bg-secondary'
                                            : 'bg-accent-600 text-white hover:bg-accent-700'
                                    }`}
                                    {...getAnalyticsDebugAttributes('trip_generation__claim_conflict_modal--create_similar', {
                                        trip_id: tripId,
                                        source: 'trip_claim_conflict_modal',
                                    })}
                                >
                                    {t('tripView.claimConflict.createSimilarCta')}
                                </Link>
                            </div>
                        </div>

                        <aside className="border-t border-border bg-secondary/80 p-5 md:border-s md:border-t-0 sm:p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t('tripView.claimConflict.benefitsTitle')}
                            </p>
                            <ul className="mt-4 space-y-3">
                                {[
                                    t('tripView.claimConflict.benefits.prefill'),
                                    t('tripView.claimConflict.benefits.adjust'),
                                ].map((benefit) => (
                                    <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-foreground">
                                        <Check size={16} weight="bold" className="mt-1 shrink-0 text-accent-600 dark:text-accent-300" />
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </aside>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
