import React from 'react';
import { X } from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { RecommendationCardFace, RecommendationSources } from './RecommendationCardContent';
import type { Recommendation } from '../../shared/recommendations';

/**
 * The full card, opened from a mini card in one of the pools.
 *
 * A list row cannot show a photo, a map, the description and the tips at once,
 * and shrinking the card into a row was what made the kept pile unreadable.
 * The card is the unit of information, so the list links back to it whole.
 */
export const RecommendationDetailDialog: React.FC<{
    recommendation: Recommendation | null;
    tripId: string;
    onClose: () => void;
    /** Rendered under the card: assign, remove, restore — whatever the pool offers. */
    actions?: React.ReactNode;
}> = ({ recommendation, tripId, onClose, actions }) => (
    <Dialog open={Boolean(recommendation)} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent
            size="sm"
            data-testid="recommendation-detail-dialog"
            className="max-h-[min(88dvh,50rem)] overflow-hidden rounded-3xl"
        >
            {recommendation && (
                <>
                    <DialogTitle className="sr-only">{recommendation.title}</DialogTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute end-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/50"
                    >
                        <X size={17} />
                    </button>

                    <RecommendationCardFace
                        recommendation={recommendation}
                        tripId={tripId}
                        beforeFooter={<RecommendationSources recommendation={recommendation} />}
                    />

                    {actions && (
                        <div className="shrink-0 border-t border-border p-3">{actions}</div>
                    )}
                </>
            )}
        </DialogContent>
    </Dialog>
);
