import React from 'react';

import { RecommendationMiniCard } from './RecommendationMiniCard';
import type { Recommendation } from '../../shared/recommendations';

/**
 * One of the two pools behind the deck: kept, or skipped.
 *
 * They differ only in the corner action and the line shown when empty, so they
 * share a component — otherwise the two lists drift apart every time one of
 * them is touched.
 */
export const RecommendationPoolList: React.FC<{
    testId: string;
    recommendations: Recommendation[];
    emptyMessage: string;
    onOpen: (recommendationId: string) => void;
    renderAction: (recommendation: Recommendation) => React.ReactNode;
}> = ({ testId, recommendations, emptyMessage, onOpen, renderAction }) => (
    <div
        data-testid={testId}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
    >
        {recommendations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
            <ul className="flex flex-col gap-2">
                {recommendations.map((recommendation) => (
                    <li key={recommendation.id}>
                        <RecommendationMiniCard
                            recommendation={recommendation}
                            onOpen={() => onOpen(recommendation.id)}
                            action={renderAction(recommendation)}
                        />
                    </li>
                ))}
            </ul>
        )}
    </div>
);
