import type {
    ActivityType,
    ITrip,
    ITripActivityBoardCard,
    ITimelineItem,
    TripActivityWorkflowStatus,
} from '../../../types';
import { normalizeActivityTypes } from '../../../utils';
import type { TripWorkspaceExploreLead } from './tripWorkspaceDemoData';

export const TRIP_ACTIVITY_WORKFLOW_STATUSES: TripActivityWorkflowStatus[] = [
    'shortlist',
    'planned',
    'booked',
    'done',
];

export type TripActivityBoardInsertPosition = 'before' | 'after';
export interface TripActivityBoardInsertionCandidate {
    id: string;
    top: number;
    height: number;
}

const STATUS_INDEX = new Map<TripActivityWorkflowStatus, number>(
    TRIP_ACTIVITY_WORKFLOW_STATUSES.map((status, index) => [status, index]),
);

const compareCards = (left: ITripActivityBoardCard, right: ITripActivityBoardCard) => {
    const leftStatus = STATUS_INDEX.get(left.status) ?? 0;
    const rightStatus = STATUS_INDEX.get(right.status) ?? 0;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.title.localeCompare(right.title);
};

export const resolveCityItemIdForActivity = (
    items: ITimelineItem[],
    activityItem: Pick<ITimelineItem, 'startDateOffset' | 'type'>,
): string | null => {
    if (activityItem.type !== 'activity') return null;
    const city = items.find((item) => (
        item.type === 'city'
        && activityItem.startDateOffset >= item.startDateOffset
        && activityItem.startDateOffset < item.startDateOffset + item.duration
    ));
    return city?.id ?? null;
};

export const createPlannerActivityBoardCard = (
    item: ITimelineItem,
    items: ITimelineItem[],
): ITripActivityBoardCard => ({
    id: `timeline-${item.id}`,
    title: item.title,
    cityItemId: resolveCityItemIdForActivity(items, item),
    timelineItemId: item.id,
    source: 'planner',
    status: 'planned',
    activityType: normalizeActivityTypes(item.activityType),
    description: item.description,
    sortOrder: Math.round(item.startDateOffset * 100),
});

export const createExploreLeadBoardCard = (
    lead: TripWorkspaceExploreLead,
    cityItemId: string | null,
): ITripActivityBoardCard => ({
    id: `explore-${lead.id}`,
    title: lead.title,
    cityItemId,
    source: 'explore',
    status: 'shortlist',
    activityType: normalizeActivityTypes(lead.activityTypes),
    description: lead.description,
    externalUrl: `https://www.google.com/search?q=${encodeURIComponent(lead.query)}`,
    note: lead.reason,
    sortOrder: 0,
});

export const sortTripActivityBoardCards = (cards: ITripActivityBoardCard[]): ITripActivityBoardCard[] => (
    [...cards].sort(compareCards)
);

export const normalizeTripActivityBoardCards = (cards: ITripActivityBoardCard[]): ITripActivityBoardCard[] => {
    const sorted = sortTripActivityBoardCards(cards).map((card) => ({
        ...card,
        activityType: normalizeActivityTypes(card.activityType),
        timelineItemId: card.timelineItemId ?? null,
    }));

    return TRIP_ACTIVITY_WORKFLOW_STATUSES.flatMap((status) => (
        sorted
            .filter((card) => card.status === status)
            .map((card, index) => ({
                ...card,
                sortOrder: index,
            }))
    ));
};

const reindexTripActivityBoardCards = (cards: ITripActivityBoardCard[]): ITripActivityBoardCard[] => {
    const prepared = cards.map((card) => ({
        ...card,
        activityType: normalizeActivityTypes(card.activityType),
        timelineItemId: card.timelineItemId ?? null,
    }));

    return TRIP_ACTIVITY_WORKFLOW_STATUSES.flatMap((status) => (
        prepared
            .filter((card) => card.status === status)
            .map((card, index) => ({
                ...card,
                sortOrder: index,
            }))
    ));
};

export const deriveTripActivityBoardCards = (trip: ITrip): ITripActivityBoardCard[] => {
    const explicitCards = normalizeTripActivityBoardCards(trip.activityBoard ?? []);
    const explicitTimelineIds = new Set(
        explicitCards
            .map((card) => card.timelineItemId)
            .filter((value): value is string => Boolean(value)),
    );

    const implicitCards = trip.items
        .filter((item): item is ITimelineItem => item.type === 'activity')
        .filter((item) => !explicitTimelineIds.has(item.id))
        .map((item) => createPlannerActivityBoardCard(item, trip.items));

    return normalizeTripActivityBoardCards([...explicitCards, ...implicitCards]);
};

export const materializeTripActivityBoardCards = (trip: ITrip): ITripActivityBoardCard[] => (
    normalizeTripActivityBoardCards(deriveTripActivityBoardCards(trip))
);

export const getTripActivityBoardCardForTimelineItem = (
    trip: ITrip,
    timelineItemId: string | null | undefined,
): ITripActivityBoardCard | null => {
    if (!timelineItemId) return null;
    return deriveTripActivityBoardCards(trip).find((card) => card.timelineItemId === timelineItemId) ?? null;
};

const resolveInsertIndex = (
    cards: ITripActivityBoardCard[],
    targetStatus: TripActivityWorkflowStatus,
    overId?: string | null,
    insertPosition: TripActivityBoardInsertPosition = 'before',
): number => {
    if (overId) {
        const overIndex = cards.findIndex((card) => card.id === overId);
        if (overIndex >= 0) return insertPosition === 'after' ? overIndex + 1 : overIndex;
    }

    const lastMatchingIndex = [...cards]
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => card.status === targetStatus)
        .at(-1);

    return lastMatchingIndex ? lastMatchingIndex.index + 1 : cards.length;
};

export const resolveTripActivityBoardInsertion = (
    candidates: TripActivityBoardInsertionCandidate[],
    activeCenterY: number,
): {
    overCardId: string | null;
    insertPosition: TripActivityBoardInsertPosition | null;
} => {
    if (candidates.length === 0) {
        return {
            overCardId: null,
            insertPosition: null,
        };
    }

    const sortedCandidates = [...candidates].sort((left, right) => left.top - right.top);
    const nextCandidate = sortedCandidates.find((candidate) => activeCenterY <= candidate.top + candidate.height / 2);

    if (nextCandidate) {
        return {
            overCardId: nextCandidate.id,
            insertPosition: 'before',
        };
    }

    return {
        overCardId: sortedCandidates.at(-1)?.id ?? null,
        insertPosition: 'after',
    };
};

export const moveTripActivityBoardCard = (
    cards: ITripActivityBoardCard[],
    cardId: string,
    targetStatus: TripActivityWorkflowStatus,
    overId?: string | null,
    insertPosition: TripActivityBoardInsertPosition = 'before',
): ITripActivityBoardCard[] => {
    const nextCards = normalizeTripActivityBoardCards(cards).map((card) => ({ ...card }));
    const activeIndex = nextCards.findIndex((card) => card.id === cardId);
    if (activeIndex < 0) return nextCards;

    const [activeCard] = nextCards.splice(activeIndex, 1);
    activeCard.status = targetStatus;
    const insertIndex = resolveInsertIndex(nextCards, targetStatus, overId, insertPosition);
    nextCards.splice(insertIndex, 0, activeCard);

    return reindexTripActivityBoardCards(nextCards);
};

export const linkTripActivityBoardCard = (
    cards: ITripActivityBoardCard[],
    cardId: string,
    item: Pick<ITimelineItem, 'id' | 'description' | 'activityType'>,
): ITripActivityBoardCard[] => normalizeTripActivityBoardCards(
    cards.map((card) => (
        card.id === cardId
            ? {
                ...card,
                timelineItemId: item.id,
                status: 'planned',
                description: item.description || card.description,
                activityType: normalizeActivityTypes(item.activityType, card.activityType),
            }
            : card
    )),
);

export const returnTripActivityBoardCardToShortlist = (
    cards: ITripActivityBoardCard[],
    cardId: string,
): ITripActivityBoardCard[] => moveTripActivityBoardCard(
    cards.map((card) => (
        card.id === cardId
            ? {
                ...card,
                timelineItemId: null,
            }
            : card
    )),
    cardId,
    'shortlist',
);

export const getActivityBoardCityLabel = (
    card: ITripActivityBoardCard,
    items: ITimelineItem[],
): string => {
    if (!card.cityItemId) return 'Route-wide';
    return items.find((item) => item.id === card.cityItemId)?.title ?? 'Route-wide';
};

export const getActivityBoardPrimaryType = (card: ITripActivityBoardCard): ActivityType => (
    normalizeActivityTypes(card.activityType)[0] ?? 'general'
);
