import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

import { buildRecommendationMapUrl, buildRecommendationPhotoUrl } from './recommendationCardMedia';
import { formatCostBandLabel, type Recommendation } from '../../shared/recommendations';

/**
 * A pool entry: a thumbnail, a name, and a tap that opens the whole card.
 *
 * The pools used to be text panels, which showed less than the deck did and
 * gave nothing to tap. A mini card keeps the picture that made the idea
 * recognisable in the first place.
 */
export const RecommendationMiniCard: React.FC<{
    recommendation: Recommendation;
    onOpen: () => void;
    /** Rendered in the corner: remove, restore — whatever the pool offers. */
    action?: React.ReactNode;
}> = ({ recommendation, onOpen, action }) => {
    // Two fallbacks, because both sources can fail independently: the photo,
    // then the map, then the pin. A broken-image icon in a list is worse than
    // no image at all.
    const [photoFailed, setPhotoFailed] = useState(false);
    const [mapFailed, setMapFailed] = useState(false);
    const photoUrl = photoFailed ? null : buildRecommendationPhotoUrl(recommendation, 320);
    const mapUrl = mapFailed ? null : buildRecommendationMapUrl(recommendation, { width: 160, height: 160 });
    const thumbUrl = photoUrl ?? mapUrl;
    const meta = [recommendation.cityName, formatCostBandLabel(recommendation.costBand)]
        .filter(Boolean)
        .join(' · ');

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onOpen}
                data-testid="recommendation-mini-card"
                data-recommendation-id={recommendation.id}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2 pe-11 text-start transition-colors hover:border-accent-300 hover:bg-accent-50/40 dark:hover:bg-accent-400/12 dark:hover:border-accent-400/30"
            >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {thumbUrl ? (
                        <img
                            src={thumbUrl}
                            alt=""
                            loading="lazy"
                            onError={() => (photoUrl ? setPhotoFailed(true) : setMapFailed(true))}
                            className="size-full object-cover"
                        />
                    ) : (
                        <span className="flex size-full items-center justify-center text-slate-300">
                            <MapPin size={18} />
                        </span>
                    )}
                </span>

                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-foreground">
                        {recommendation.title}
                    </span>
                    {meta && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>}
                    {recommendation.summary && (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{recommendation.summary}</span>
                    )}
                </span>
            </button>

            {action && <div className="absolute end-2 top-1/2 -translate-y-1/2">{action}</div>}
        </div>
    );
};
