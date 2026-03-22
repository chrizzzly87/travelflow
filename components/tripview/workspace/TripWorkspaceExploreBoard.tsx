import React from 'react';
import {
    DndContext,
    PointerSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowSquareOut,
    CalendarBlank,
    CheckCircle,
    DotsThreeOutlineVertical,
    MapPin,
    SuitcaseRolling,
    Trash,
} from '@phosphor-icons/react';

import type {
    ActivityType,
    ITrip,
    ITripActivityBoardCard,
    TripActivityWorkflowStatus,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { formatActivityTypeLabel } from '../../ActivityTypeVisuals';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { ScrollArea } from '../../ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import {
    TRIP_ACTIVITY_WORKFLOW_STATUSES,
    deriveTripActivityBoardCards,
    getActivityBoardCityLabel,
    getActivityBoardPrimaryType,
    materializeTripActivityBoardCards,
    moveTripActivityBoardCard,
} from './tripActivityBoard';

interface TripWorkspaceExploreBoardProps {
    trip: ITrip;
    isMobile: boolean;
    cityFilter: string;
    onCityFilterChange: (value: string) => void;
    typeFilter: 'all' | ActivityType;
    onTypeFilterChange: (value: 'all' | ActivityType) => void;
    onOpenPlannerItem?: (itemId: string) => void;
    onScheduleBoardCard: (card: ITripActivityBoardCard) => void;
    onUpdateActivityBoard: (cards: ITripActivityBoardCard[], label: string) => void;
    onRemoveFromItinerary: (card: ITripActivityBoardCard) => void;
}

const STATUS_COPY: Record<TripActivityWorkflowStatus, { label: string; detail: string; tone: string }> = {
    shortlist: {
        label: 'Shortlist',
        detail: 'High-signal ideas that still need a route slot.',
        tone: 'border-sky-200/80 bg-sky-50/70 text-sky-700',
    },
    planned: {
        label: 'Planned',
        detail: 'Scheduled into the trip, but not confirmed as booked.',
        tone: 'border-amber-200/80 bg-amber-50/70 text-amber-700',
    },
    booked: {
        label: 'Booked',
        detail: 'Locked decisions that should stay visible for logistics.',
        tone: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-700',
    },
    done: {
        label: 'Done',
        detail: 'Finished experiences worth keeping on the trip record.',
        tone: 'border-violet-200/80 bg-violet-50/70 text-violet-700',
    },
};

const STATUS_OPTIONS = TRIP_ACTIVITY_WORKFLOW_STATUSES.map((status) => ({
    value: status,
    label: STATUS_COPY[status].label,
}));

const openExternalUrl = (href: string) => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

const ActivityBoardCardMenu: React.FC<{
    card: ITripActivityBoardCard;
    tripId: string;
    onOpenPlannerItem?: (itemId: string) => void;
    onScheduleBoardCard: (card: ITripActivityBoardCard) => void;
    onUpdateStatus: (card: ITripActivityBoardCard, status: TripActivityWorkflowStatus) => void;
    onRemoveFromItinerary: (card: ITripActivityBoardCard) => void;
}> = ({
    card,
    tripId,
    onOpenPlannerItem,
    onScheduleBoardCard,
    onUpdateStatus,
    onRemoveFromItinerary,
}) => {
    const canReturnToShortlist = !card.timelineItemId;
    const moveTargets = STATUS_OPTIONS.filter(({ value }) => {
        if (card.status === 'shortlist') return value === 'planned';
        if (value === card.status) return false;
        if (value === 'shortlist') return canReturnToShortlist;
        return true;
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label="Open activity card menu">
                    <DotsThreeOutlineVertical weight="duotone" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    {card.timelineItemId && onOpenPlannerItem ? (
                        <DropdownMenuItem
                            onClick={() => {
                                trackEvent('trip_workspace__activity_board_card--open_planner', {
                                    trip_id: tripId,
                                    card_id: card.id,
                                });
                                onOpenPlannerItem(card.timelineItemId!);
                            }}
                        >
                            Open in planner
                        </DropdownMenuItem>
                    ) : null}
                    {card.externalUrl ? (
                        <DropdownMenuItem
                            onClick={() => {
                                trackEvent('trip_workspace__activity_board_card--research', {
                                    trip_id: tripId,
                                    card_id: card.id,
                                });
                                openExternalUrl(card.externalUrl);
                            }}
                        >
                            Research this activity
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    {moveTargets.map(({ value, label }) => (
                        <DropdownMenuItem
                            key={value}
                            onClick={() => {
                                if (card.status === 'shortlist' && value === 'planned') {
                                    onScheduleBoardCard(card);
                                    return;
                                }
                                onUpdateStatus(card, value);
                            }}
                        >
                            {value === 'planned' && card.status === 'shortlist' ? 'Plan in itinerary' : `Move to ${label}`}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
                {card.timelineItemId ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onRemoveFromItinerary(card)}
                            >
                                Remove from itinerary
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const ExploreBoardCard: React.FC<{
    card: ITripActivityBoardCard;
    trip: ITrip;
    isMobile: boolean;
    onOpenPlannerItem?: (itemId: string) => void;
    onScheduleBoardCard: (card: ITripActivityBoardCard) => void;
    onUpdateStatus: (card: ITripActivityBoardCard, status: TripActivityWorkflowStatus) => void;
    onRemoveFromItinerary: (card: ITripActivityBoardCard) => void;
}> = ({
    card,
    trip,
    isMobile,
    onOpenPlannerItem,
    onScheduleBoardCard,
    onUpdateStatus,
    onRemoveFromItinerary,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        disabled: isMobile,
    });

    const primaryType = getActivityBoardPrimaryType(card);
    const cardStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : 1,
    };

    return (
        <div ref={setNodeRef} style={cardStyle} {...attributes} {...listeners}>
            <Card className="border-border/70 bg-background shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="gap-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{getActivityBoardCityLabel(card, trip.items)}</Badge>
                                <Badge variant="secondary">{card.source === 'explore' ? 'Saved from discover' : 'From planner'}</Badge>
                            </div>
                            <CardTitle className="mt-3 text-base leading-6">{card.title}</CardTitle>
                            <CardDescription className="mt-2 text-sm leading-6">
                                {card.description || card.note || 'No summary yet.'}
                            </CardDescription>
                        </div>
                        <ActivityBoardCardMenu
                            card={card}
                            tripId={trip.id}
                            onOpenPlannerItem={onOpenPlannerItem}
                            onScheduleBoardCard={onScheduleBoardCard}
                            onUpdateStatus={onUpdateStatus}
                            onRemoveFromItinerary={onRemoveFromItinerary}
                        />
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                        {card.activityType.slice(0, 3).map((type) => (
                            <Badge key={type} variant={type === primaryType ? 'secondary' : 'outline'}>
                                {formatActivityTypeLabel(type)}
                            </Badge>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {card.status === 'shortlist' ? (
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => onScheduleBoardCard(card)}
                                {...getAnalyticsDebugAttributes('trip_workspace__activity_board_card--schedule', {
                                    trip_id: trip.id,
                                    card_id: card.id,
                                })}
                            >
                                <CalendarBlank data-icon="inline-start" weight="duotone" />
                                Plan it
                            </Button>
                        ) : null}
                        {card.status === 'planned' ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => onUpdateStatus(card, 'booked')}>
                                <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                                Mark booked
                            </Button>
                        ) : null}
                        {card.status === 'booked' ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => onUpdateStatus(card, 'done')}>
                                <CheckCircle data-icon="inline-start" weight="duotone" />
                                Mark done
                            </Button>
                        ) : null}
                        {card.timelineItemId && onOpenPlannerItem ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenPlannerItem(card.timelineItemId!)}>
                                <MapPin data-icon="inline-start" weight="duotone" />
                                Open in planner
                            </Button>
                        ) : null}
                        {card.externalUrl ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => openExternalUrl(card.externalUrl!)}>
                                <ArrowSquareOut data-icon="inline-start" weight="duotone" />
                                Research
                            </Button>
                        ) : null}
                        {card.timelineItemId ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveFromItinerary(card)}>
                                <Trash data-icon="inline-start" weight="duotone" />
                                Remove from itinerary
                            </Button>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const ExploreBoardColumn: React.FC<{
    status: TripActivityWorkflowStatus;
    cards: ITripActivityBoardCard[];
    trip: ITrip;
    isMobile: boolean;
    onOpenPlannerItem?: (itemId: string) => void;
    onScheduleBoardCard: (card: ITripActivityBoardCard) => void;
    onUpdateStatus: (card: ITripActivityBoardCard, status: TripActivityWorkflowStatus) => void;
    onRemoveFromItinerary: (card: ITripActivityBoardCard) => void;
}> = ({
    status,
    cards,
    trip,
    isMobile,
    onOpenPlannerItem,
    onScheduleBoardCard,
    onUpdateStatus,
    onRemoveFromItinerary,
}) => {
    const { setNodeRef, isOver } = useDroppable({ id: `column-${status}` });
    const statusCopy = STATUS_COPY[status];

    return (
        <div className="flex min-h-[32rem] min-w-[18rem] flex-1 flex-col rounded-[1.75rem] border border-border/70 bg-card/80">
            <div className={`rounded-t-[1.75rem] border-b px-4 py-4 ${statusCopy.tone}`}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">{statusCopy.label}</p>
                        <p className="mt-1 text-xs leading-5 opacity-80">{statusCopy.detail}</p>
                    </div>
                    <Badge variant="outline" className="bg-background/80">{cards.length}</Badge>
                </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
                <div
                    ref={setNodeRef}
                    className={`flex min-h-full flex-col gap-3 px-4 py-4 transition-colors ${isOver ? 'bg-accent/5' : ''}`}
                >
                    <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
                        {cards.map((card) => (
                            <ExploreBoardCard
                                key={card.id}
                                card={card}
                                trip={trip}
                                isMobile={isMobile}
                                onOpenPlannerItem={onOpenPlannerItem}
                                onScheduleBoardCard={onScheduleBoardCard}
                                onUpdateStatus={onUpdateStatus}
                                onRemoveFromItinerary={onRemoveFromItinerary}
                            />
                        ))}
                    </SortableContext>
                    {cards.length === 0 ? (
                        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/80 px-4 py-6 text-sm text-muted-foreground">
                            No cards in this lane yet.
                        </div>
                    ) : null}
                </div>
            </ScrollArea>
        </div>
    );
};

export const TripWorkspaceExploreBoard: React.FC<TripWorkspaceExploreBoardProps> = ({
    trip,
    isMobile,
    cityFilter,
    onCityFilterChange,
    typeFilter,
    onTypeFilterChange,
    onOpenPlannerItem,
    onScheduleBoardCard,
    onUpdateActivityBoard,
    onRemoveFromItinerary,
}) => {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const derivedCards = React.useMemo(() => deriveTripActivityBoardCards(trip), [trip]);
    const materializedCards = React.useMemo(() => materializeTripActivityBoardCards(trip), [trip]);
    const cityOptions = React.useMemo(() => {
        const valueMap = new Map<string, string>();
        derivedCards.forEach((card) => {
            if (!card.cityItemId || valueMap.has(card.cityItemId)) return;
            valueMap.set(card.cityItemId, getActivityBoardCityLabel(card, trip.items));
        });
        return Array.from(valueMap.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((left, right) => left.label.localeCompare(right.label));
    }, [derivedCards, trip.items]);

    const filteredCards = React.useMemo(() => derivedCards.filter((card) => {
        if (cityFilter !== 'all' && card.cityItemId !== cityFilter) return false;
        if (typeFilter !== 'all' && !card.activityType.includes(typeFilter)) return false;
        return true;
    }), [cityFilter, derivedCards, typeFilter]);

    const cardsByStatus = React.useMemo(
        () => Object.fromEntries(
            TRIP_ACTIVITY_WORKFLOW_STATUSES.map((status) => [
                status,
                filteredCards.filter((card) => card.status === status),
            ]),
        ) as Record<TripActivityWorkflowStatus, ITripActivityBoardCard[]>,
        [filteredCards],
    );

    const handleUpdateStatus = React.useCallback((
        card: ITripActivityBoardCard,
        status: TripActivityWorkflowStatus,
    ) => {
        if (card.status === 'shortlist' && status === 'planned') {
            trackEvent('trip_workspace__activity_board_card--schedule', {
                trip_id: trip.id,
                card_id: card.id,
                source: 'button',
            });
            onScheduleBoardCard(card);
            return;
        }
        const nextCards = moveTripActivityBoardCard(materializedCards, card.id, status);
        trackEvent('trip_workspace__activity_board_card--move', {
            trip_id: trip.id,
            card_id: card.id,
            status,
            source: 'action',
        });
        onUpdateActivityBoard(nextCards, `Data: Updated activity workflow for "${card.title}"`);
    }, [materializedCards, onScheduleBoardCard, onUpdateActivityBoard, trip.id]);

    const handleDragEnd = React.useCallback((event: DragEndEvent) => {
        if (isMobile) return;
        const activeId = String(event.active.id);
        const overId = event.over ? String(event.over.id) : null;
        if (!overId || activeId === overId) return;

        const activeCard = derivedCards.find((card) => card.id === activeId);
        if (!activeCard) return;

        const overCard = derivedCards.find((card) => card.id === overId) ?? null;
        const targetStatus = overId.startsWith('column-')
            ? overId.replace('column-', '') as TripActivityWorkflowStatus
            : overCard?.status ?? activeCard.status;

        if (activeCard.status === 'shortlist' && targetStatus === 'planned') {
            trackEvent('trip_workspace__activity_board_card--schedule', {
                trip_id: trip.id,
                card_id: activeCard.id,
                source: 'drag',
            });
            onScheduleBoardCard(activeCard);
            return;
        }

        if (activeCard.status === 'shortlist' && targetStatus !== 'shortlist') {
            return;
        }
        if (targetStatus === 'shortlist' && activeCard.timelineItemId) {
            return;
        }

        const nextCards = moveTripActivityBoardCard(materializedCards, activeCard.id, targetStatus, overCard?.id);
        trackEvent('trip_workspace__activity_board_card--move', {
            trip_id: trip.id,
            card_id: activeCard.id,
            status: targetStatus,
            source: 'drag',
        });
        onUpdateActivityBoard(nextCards, `Data: Updated activity workflow for "${activeCard.title}"`);
    }, [derivedCards, isMobile, materializedCards, onScheduleBoardCard, onUpdateActivityBoard, trip.id]);

    return (
        <div className="flex flex-col gap-4">
            <Card className="border-border/80 bg-linear-to-br from-accent/10 via-background to-sky-50 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Activity workflow board</CardDescription>
                    <CardTitle>Move ideas from shortlist to booked and done</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Select value={cityFilter} onValueChange={onCityFilterChange}>
                            <SelectTrigger className="h-10" aria-label="Filter activity board by city">
                                <SelectValue placeholder="Filter by city" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Cities</SelectLabel>
                                    <SelectItem value="all">Entire route</SelectItem>
                                    {cityOptions.map((city) => (
                                        <SelectItem key={city.id} value={city.id}>
                                            {city.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Select value={typeFilter} onValueChange={(value) => onTypeFilterChange(value as ActivityType | 'all')}>
                            <SelectTrigger className="h-10" aria-label="Filter activity board by activity type">
                                <SelectValue placeholder="Filter by activity type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectLabel>Activity type</SelectLabel>
                                    <SelectItem value="all">All activity types</SelectItem>
                                    {(['general', 'food', 'culture', 'sightseeing', 'relaxation', 'nightlife', 'sports', 'hiking', 'wildlife', 'shopping', 'adventure', 'beach', 'nature'] as ActivityType[]).map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {formatActivityTypeLabel(type)}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center justify-end gap-2">
                            <Badge variant="outline">{derivedCards.length} total cards</Badge>
                            <Badge variant="secondary">{cardsByStatus.booked.length} booked</Badge>
                        </div>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Activity leads saved from discovery land in <span className="font-medium text-foreground">Shortlist</span>. Planner activities appear here as <span className="font-medium text-foreground">Planned</span> cards, and mobile uses menu-based moves instead of drag and drop.
                    </p>
                </CardContent>
            </Card>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                <ScrollArea className="w-full">
                    <div className="flex min-w-max gap-4 pb-4">
                        {TRIP_ACTIVITY_WORKFLOW_STATUSES.map((status) => (
                            <ExploreBoardColumn
                                key={status}
                                status={status}
                                cards={cardsByStatus[status]}
                                trip={trip}
                                isMobile={isMobile}
                                onOpenPlannerItem={onOpenPlannerItem}
                                onScheduleBoardCard={onScheduleBoardCard}
                                onUpdateStatus={handleUpdateStatus}
                                onRemoveFromItinerary={onRemoveFromItinerary}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </DndContext>
        </div>
    );
};
