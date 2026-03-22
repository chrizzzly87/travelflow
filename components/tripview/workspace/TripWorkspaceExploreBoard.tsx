import React from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    DotsSixVertical,
    DotsThreeOutlineVertical,
} from '@phosphor-icons/react';
import { createPortal } from 'react-dom';

import type {
    ActivityType,
    ITrip,
    ITripActivityBoardCard,
    TripActivityWorkflowStatus,
} from '../../../types';
import { trackEvent } from '../../../services/analyticsService';
import { cn } from '../../../lib/utils';
import { formatActivityTypeLabel } from '../../ActivityTypeVisuals';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardHeader, CardTitle } from '../../ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
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

const STATUS_COPY: Record<TripActivityWorkflowStatus, {
    label: string;
    dotTone: string;
}> = {
    shortlist: {
        label: 'Shortlist',
        dotTone: 'bg-sky-500',
    },
    planned: {
        label: 'Planned',
        dotTone: 'bg-amber-500',
    },
    booked: {
        label: 'Booked',
        dotTone: 'bg-emerald-500',
    },
    done: {
        label: 'Done',
        dotTone: 'bg-violet-500',
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

const getActivityBoardSourceLabel = (card: ITripActivityBoardCard) => (
    card.source === 'explore' ? 'Discover' : 'Planner'
);

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
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Open activity card menu" className="rounded-xl text-muted-foreground">
                    <DotsThreeOutlineVertical weight="duotone" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[1760] w-56 rounded-xl border-border/70 shadow-xl">
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
    const primaryType = getActivityBoardPrimaryType(card);
    const cityLabel = getActivityBoardCityLabel(card, trip.items);
    const sourceLabel = getActivityBoardSourceLabel(card);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        disabled: isMobile,
    });
    const cardStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.12 : 1,
    };
    const dragHandleProps = isMobile ? {} : { ...attributes, ...listeners };

    return (
        <div ref={setNodeRef} style={cardStyle}>
            <Card className={cn(
                'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs transition-[transform,box-shadow,border-color]',
                'hover:-translate-y-0.5 hover:border-border hover:shadow-md',
                isDragging && 'shadow-none',
            )}>
                <CardHeader className="px-3 py-3">
                    <div className="flex items-start gap-2.5">
                        <button
                            type="button"
                            aria-label="Drag activity card"
                            className={cn(
                                'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors',
                                'hover:bg-muted hover:text-foreground',
                                isMobile && 'hidden',
                            )}
                            {...dragHandleProps}
                        >
                            <DotsSixVertical weight="bold" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <CardTitle className="line-clamp-2 text-sm leading-5 font-medium">{card.title}</CardTitle>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[11px]">
                                    {cityLabel}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                                    {formatActivityTypeLabel(primaryType)}
                                </Badge>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                    {sourceLabel}
                                </span>
                            </div>
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
            </Card>
        </div>
    );
};

const ExploreBoardCardOverlay: React.FC<{
    card: ITripActivityBoardCard;
    trip: ITrip;
}> = ({ card, trip }) => {
    const primaryType = getActivityBoardPrimaryType(card);
    const cityLabel = getActivityBoardCityLabel(card, trip.items);

    return (
        <Card className="w-[14.25rem] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/15">
            <CardHeader className="px-3 py-3">
                <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <DotsSixVertical weight="bold" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-2 text-sm leading-5 font-medium">{card.title}</CardTitle>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="rounded-full border-border/70 bg-background px-2 py-0.5 text-[11px]">
                                {cityLabel}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[11px]">
                                {formatActivityTypeLabel(primaryType)}
                            </Badge>
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>
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
        <section className={cn(
            'flex min-h-[29rem] w-[14.5rem] min-w-[14.5rem] max-w-[14.5rem] flex-col rounded-[1.6rem] border border-border/70 bg-muted/20 shadow-xs',
            isOver && 'border-accent/40 bg-accent/5',
        )}>
            <div className="border-b border-border/60 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', statusCopy.dotTone)} />
                        <p className="text-sm font-medium text-foreground">{statusCopy.label}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-background px-2 py-0.5 text-[11px]">
                        {cards.length}
                    </Badge>
                </div>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-visible px-2.5 py-2.5',
                )}
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
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/75 px-3 py-4 text-xs leading-5 text-muted-foreground">
                        No cards in this lane yet.
                    </div>
                ) : null}
            </div>
        </section>
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
    const [activeCardId, setActiveCardId] = React.useState<string | null>(null);

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
    const activeCard = React.useMemo(
        () => activeCardId ? derivedCards.find((card) => card.id === activeCardId) ?? null : null,
        [activeCardId, derivedCards],
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

    const handleDragStart = React.useCallback((event: DragStartEvent) => {
        if (isMobile) return;
        setActiveCardId(String(event.active.id));
    }, [isMobile]);

    const handleDragEnd = React.useCallback((event: DragEndEvent) => {
        setActiveCardId(null);
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
            <section className="rounded-2xl border border-border/70 bg-card/90 px-3 py-3 shadow-sm">
                <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-foreground">Activity board</p>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_1fr]">
                        <Select value={cityFilter} onValueChange={onCityFilterChange}>
                            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/90 shadow-xs" aria-label="Filter activity board by city">
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
                            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/90 shadow-xs" aria-label="Filter activity board by activity type">
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
                        <div className="flex items-center gap-2 text-xs leading-5 text-muted-foreground lg:justify-end">
                            <span className="rounded-full border border-border/70 bg-background px-3 py-2">
                                Desktop drag, mobile menu.
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragCancel={() => setActiveCardId(null)}
                onDragEnd={handleDragEnd}
            >
                <div className="overflow-x-auto pb-2">
                    <div className="flex min-w-max items-start gap-4">
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
                </div>
                {typeof document !== 'undefined'
                    ? createPortal(
                        <DragOverlay zIndex={1800}>
                            {activeCard ? <ExploreBoardCardOverlay card={activeCard} trip={trip} /> : null}
                        </DragOverlay>,
                        document.body,
                    )
                    : null}
            </DndContext>
        </div>
    );
};
