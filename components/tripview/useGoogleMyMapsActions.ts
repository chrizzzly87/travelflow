import { useCallback, useMemo, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { AppLanguage, ITrip, ITripRecommendationState } from '../../types';
import type { SavedRecommendation } from '../../shared/recommendations';
import { mergeImportedIdeas } from '../../shared/googleMyMaps';
import { listActiveIdeas } from '../../shared/tripIdeas';
import {
    mergeRecommendationState,
    readStoredRecommendationState,
    writeStoredRecommendationState,
} from '../../services/recommendationReactionsStore';
import { buildTripKml, downloadTripKml } from '../../services/tripKmlExportService';
import { trackEvent } from '../../services/analyticsService';
import { getIntlLocaleForAppLanguage } from '../../utils';

interface UseGoogleMyMapsActionsInput {
    trip: ITrip;
    displayTrip: ITrip;
    tripRef: MutableRefObject<ITrip>;
    appLanguage: AppLanguage;
    /** Saved ideas as the trip and this device know them together. */
    ideaState: ITripRecommendationState;
    /** Writes ideas to the trip and commits it to the database. */
    commitRecommendationState: (next: ITripRecommendationState, label?: string) => void;
    onIdeasImported?: () => void;
}

/**
 * Trip-side handlers for the Google My Maps panel.
 *
 * Kept ideas have two homes, the trip and this device (see
 * `recommendationReactionsStore`), so both are read before merging and both
 * are written after, exactly as the ideas deck does.
 */
export const useGoogleMyMapsActions = ({
    trip,
    displayTrip,
    tripRef,
    appLanguage,
    ideaState,
    commitRecommendationState,
    onIdeasImported,
}: UseGoogleMyMapsActionsInput) => {
    const { t } = useTranslation('common');
    const tripId = trip.id;

    const keptIdeaIds = useMemo(
        () => ideaState.saved.map((entry) => entry.recommendationId),
        [ideaState],
    );

    const activityTitles = useMemo(
        () => displayTrip.items.filter((item) => item.type === 'activity').map((item) => item.title),
        [displayTrip.items],
    );

    const exportKml = useCallback(() => {
        // Skipped ideas were declined; they do not belong on anybody's map.
        const bundle = buildTripKml({
            trip: displayTrip,
            ideas: listActiveIdeas(ideaState.saved),
            locale: getIntlLocaleForAppLanguage(appLanguage),
            labels: {
                route: t('tripView.infoDialog.myMaps.layers.route'),
                stops: t('tripView.infoDialog.myMaps.layers.stops'),
                activities: t('tripView.infoDialog.myMaps.layers.activities'),
                dayTrips: t('tripView.infoDialog.myMaps.layers.dayTrips'),
                ideas: t('tripView.infoDialog.myMaps.layers.ideas'),
            },
        });
        if (!downloadTripKml(bundle)) return null;
        trackEvent('trip_view__my_maps_export', {
            trip_id: tripId,
            place_count: bundle.placeCount,
            skipped_count: bundle.skippedCount,
        });
        return { placeCount: bundle.placeCount, skippedCount: bundle.skippedCount };
    }, [appLanguage, displayTrip, ideaState, t, tripId]);

    const importIdeas = useCallback((ideas: SavedRecommendation[]): number => {
        const current = mergeRecommendationState(
            tripRef.current.recommendationState,
            readStoredRecommendationState(tripId),
        );
        const { next, addedCount } = mergeImportedIdeas(current, ideas);
        // Also commit when nothing is new but the trip's own copy is behind the
        // device: ideas from an earlier import that never reached the database.
        const tripCopyCount = tripRef.current.recommendationState?.saved?.length ?? 0;
        if (addedCount === 0 && next.saved.length === tripCopyCount) return 0;
        writeStoredRecommendationState(tripId, next);
        commitRecommendationState(next, 'Data: Imported Google My Maps pins');
        onIdeasImported?.();
        return addedCount;
    }, [commitRecommendationState, onIdeasImported, tripId, tripRef]);

    return { keptIdeaIds, activityTitles, exportKml, importIdeas };
};
