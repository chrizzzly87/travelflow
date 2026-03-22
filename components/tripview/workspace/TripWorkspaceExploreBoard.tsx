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
    DotsSixVertical,
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
import { cn } from '../../../lib/utils';
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
    detail: string;
    dotTone: string;
    badgeTone: string;
    laneTone: string;
}> = {
    shortlist: {
        label: 'Shortlist',
        detail: 'High-signal ideas that still need a route slot.',
        dotTone: 'bg-sky-500',
        badgeTone: 'border-sky-200/80 bg-sky-50/90 text-sky-700',
        laneTone: 'from-sky-50/95 via-background to-sky-100/55',
    },
    planned: {
        label: 'Planned',
        detail: 'Scheduled into the trip, but not confirmed as booked.',
        dotTone: 'bg-amber-500',
        badgeTone: 'border-amber-200/80 bg-amber-50/90 text-amber-700',
        laneTone: 'from-amber-50/95 via-background to-amber-100/55',
    },
    booked: {
        label: 'Booked',
        detail: 'Locked decisions that should stay visible for logistics.',
        dotTone: 'bg-emerald-500',
        badgeTone: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700',
        laneTone: 'from-emerald-50/95 via-background to-emerald-100/55',
    },
    done: {
        label: 'Done',
        detail: 'Finished experiences worth keeping on the trip record.',
        dotTone: 'bg-violet-500',
        badgeTone: 'border-violet-200/80 bg-violet-50/90 text-violet-700',
        laneTone: 'from-violet-50/95 via-background to-violet-100/55',
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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.id,
        disabled: isMobile,
    });

    const primaryType = getActivityBoardPrimaryType(card);
    const cardStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : 1,
        zIndex: isDragging ? 30 : undefined,
    };
    const dragHandleProps = isMobile ? {} : { ...attributes, ...listeners };

    return (
        <div ref={setNodeRef} style={cardStyle} className={cn('relative', isDragging && 'z-30')}>
            <Card className={cn(
                'overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/95 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.45)] transition-all',
                'hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-24px_rgba(15,23,42,0.5)]',
                isDragging && 'ring-2 ring-accent/20 shadow-[0_24px_44px_-22px_rgba(15,23,42,0.55)]',
            )}>
                <CardHeader className="gap-3 pb-3">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            aria-label="Drag activity card"
                            className={cn(
                                'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/55 text-muted-foreground shadow-xs',
                                'transition-colors hover:bg-muted hover:text-foreground',
                                isMobile && 'hidden',
                            )}
                            {...dragHandleProps}
                        >
                            <DotsSixVertical weight="bold" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="rounded-full border-border/70 bg-background/80">
                                    {getActivityBoardCityLabel(card, trip.items)}
                                </Badge>
                                <Badge variant="secondary" className="rounded-full">
                                    {card.source === 'explore' ? 'Saved from discover' : 'From planner'}
                                </Badge>
                            </div>
                            <CardTitle className="mt-3 text-[15px] leading-6">{card.title}</CardTitle>
                            <CardDescription className="mt-2 max-w-[34ch] text-sm leading-6">
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
                <CardContent className="flex flex-col gap-4 border-t border-border/50 pt-4">
                    <div className="flex flex-wrap gap-2">
                        {card.activityType.slice(0, 3).map((type) => (
                            <Badge
                                key={type}
                                variant={type === primaryType ? 'secondary' : 'outline'}
                                className="rounded-full"
                            >
                                {formatActivityTypeLabel(type)}
                            </Badge>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {card.status === 'shortlist' ? (
                            <Button
                                type="button"
                                size="sm"
                                className="rounded-full"
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
                            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onUpdateStatus(card, 'booked')}>
                                <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                                Mark booked
                            </Button>
                        ) : null}
                        {card.status === 'booked' ? (
                            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onUpdateStatus(card, 'done')}>
                                <CheckCircle data-icon="inline-start" weight="duotone" />
                                Mark done
                            </Button>
                        ) : null}
                        {card.timelineItemId && onOpenPlannerItem ? (
                            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => onOpenPlannerItem(card.timelineItemId!)}>
                                <MapPin data-icon="inline-start" weight="duotone" />
                                Open in planner
                            </Button>
                        ) : null}
                        {card.externalUrl ? (
                            <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => openExternalUrl(card.externalUrl!)}>
                                <ArrowSquareOut data-icon="inline-start" weight="duotone" />
                                Research
                            </Button>
                        ) : null}
                        {card.timelineItemId ? (
                            <Button type="button" size="sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground" onClick={() => onRemoveFromItinerary(card)}>
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
        <section className={cn(
            'flex min-h-[35rem] w-[20rem] min-w-[20rem] max-w-[20rem] flex-col rounded-[1.75rem] border border-border/70',
            'bg-linear-to-b shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]',
            statusCopy.laneTone,
        )}>
            <div className="border-b border-border/55 px-4 py-4 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={cn('size-2.5 rounded-full', statusCopy.dotTone)} />
                            <p className="text-sm font-semibold text-foreground">{statusCopy.label}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{statusCopy.detail}</p>
                    </div>
                    <Badge variant="outline" className={cn('rounded-full bg-background/90', statusCopy.badgeTone)}>
                        {cards.length}
                    </Badge>
                </div>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-visible px-4 py-4 transition-colors',
                    isOver && 'bg-accent/5',
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
                    <div className="rounded-[1.5rem] border border-dashed border-border/65 bg-background/80 px-4 py-6 text-sm leading-6 text-muted-foreground">
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
            <section className="rounded-[1.75rem] border border-border/70 bg-background/88 px-4 py-4 shadow-sm backdrop-blur-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Activity workflow board</p>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">Move ideas from shortlist to booked and done</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full bg-background/90">{derivedCards.length} total cards</Badge>
                            <Badge variant="secondary" className="rounded-full">{cardsByStatus.booked.length} booked</Badge>
                            <Badge variant="outline" className="rounded-full bg-background/90">{cardsByStatus.done.length} done</Badge>
                        </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,14rem)_1fr]">
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
                        <div className="flex items-center gap-2 text-sm leading-6 text-muted-foreground lg:justify-end">
                            <span className="rounded-full border border-border/70 bg-muted/45 px-3 py-2">
                                Drag on desktop. Use the menu on mobile.
                            </span>
                        </div>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Activity leads saved from discovery land in <span className="font-medium text-foreground">Shortlist</span>. Planner activities appear here as <span className="font-medium text-foreground">Planned</span> cards, and mobile uses menu-based moves instead of drag and drop.
                    </p>
                </div>
            </section>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
            </DndContext>
        </div>
    );
};
