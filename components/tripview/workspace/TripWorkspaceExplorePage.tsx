import React from 'react';
import { ArrowSquareOut, CheckCircle, Compass, Sparkle, Stack } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type { ActivityType, ITrip, ITripActivityBoardCard } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_EXPLORE_LEADS,
    buildTripWorkspaceCityGuides,
    getTripWorkspaceCityItem,
} from './tripWorkspaceDemoData';
import { createExploreLeadBoardCard, deriveTripActivityBoardCards } from './tripActivityBoard';
import { TripWorkspaceExploreBoard } from './TripWorkspaceExploreBoard';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TripWorkspaceExplorePageProps {
    trip: ITrip;
    isMobile: boolean;
    mode: 'discover' | 'board';
    onModeChange: (mode: 'discover' | 'board') => void;
    onOpenPlannerItem?: (itemId: string) => void;
    onUpdateActivityBoard: (cards: ITripActivityBoardCard[], label: string) => void;
    onScheduleBoardCard: (card: ITripActivityBoardCard) => void;
    onRemoveFromItinerary: (card: ITripActivityBoardCard) => void;
}

const DISCOVERY_FILTERS = ['all', 'activity', 'stay', 'event'] as const;
type DiscoveryFilter = typeof DISCOVERY_FILTERS[number];

const openExternalUrl = (href: string) => {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
};

export const TripWorkspaceExplorePage: React.FC<TripWorkspaceExplorePageProps> = ({
    trip,
    isMobile,
    mode,
    onModeChange,
    onOpenPlannerItem,
    onUpdateActivityBoard,
    onScheduleBoardCard,
    onRemoveFromItinerary,
}) => {
    const { t } = useTranslation('common');
    const cityGuides = React.useMemo(() => buildTripWorkspaceCityGuides(trip), [trip]);
    const [activeFilter, setActiveFilter] = React.useState<DiscoveryFilter>('all');
    const [activeCityId, setActiveCityId] = React.useState<string>('all');
    const [boardCityFilter, setBoardCityFilter] = React.useState<string>('all');
    const [boardTypeFilter, setBoardTypeFilter] = React.useState<'all' | ActivityType>('all');
    const [savedLeadIds, setSavedLeadIds] = React.useState<string[]>(['krabi-ao-nang-stay']);
    const boardCards = React.useMemo(() => deriveTripActivityBoardCards(trip), [trip]);
    const savedActivityLeadIds = React.useMemo(() => new Set(
        boardCards
            .filter((card) => card.source === 'explore')
            .map((card) => card.id.replace(/^explore-/, '')),
    ), [boardCards]);

    const filteredLeads = React.useMemo(() => THAILAND_EXPLORE_LEADS.filter((lead) => {
        if (activeFilter !== 'all' && lead.type !== activeFilter) return false;
        if (activeCityId !== 'all' && lead.cityId !== activeCityId) return false;
        return true;
    }), [activeCityId, activeFilter]);

    const handleSaveActivityLead = React.useCallback((leadId: string) => {
        const lead = THAILAND_EXPLORE_LEADS.find((candidate) => candidate.id === leadId && candidate.type === 'activity');
        if (!lead) return;
        if (savedActivityLeadIds.has(lead.id)) {
            onModeChange('board');
            return;
        }
        const cityItemId = getTripWorkspaceCityItem(trip, lead.cityId)?.id ?? null;
        const nextCards = [
            ...boardCards,
            createExploreLeadBoardCard(lead, cityItemId),
        ];
        trackEvent('trip_workspace__explore_activity_shortlist--create', {
            trip_id: trip.id,
            lead_id: lead.id,
        });
        onUpdateActivityBoard(nextCards, `Data: Shortlisted activity "${lead.title}"`);
    }, [boardCards, onModeChange, onUpdateActivityBoard, savedActivityLeadIds, trip, trip.id]);

    return (
        <div className="flex flex-col gap-4">
            <Card className="border-border/80 bg-linear-to-br from-accent/10 via-background to-sky-50 shadow-sm">
                <CardHeader className="gap-3">
                    <CardDescription>Route-aware discovery and workflow</CardDescription>
                    <CardTitle>Research what fits, then move strong activity ideas through the trip</CardTitle>
                    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                        Explore still handles stays, events, and activity inspiration, but it now also owns the finer activity workflow with a board that tracks shortlist, planned, booked, and done.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <Tabs value={mode} onValueChange={(value) => {
                        trackEvent('trip_workspace__explore_mode--change', {
                            trip_id: trip.id,
                            mode: value,
                        });
                        onModeChange(value as 'discover' | 'board');
                    }}>
                        <TabsList className="grid w-full grid-cols-2 md:w-[20rem]">
                            <TabsTrigger value="discover">
                                <Compass data-icon="inline-start" weight="duotone" />
                                {t('tripView.workspace.explore.modes.discover')}
                            </TabsTrigger>
                            <TabsTrigger value="board">
                                <Stack data-icon="inline-start" weight="duotone" />
                                {t('tripView.workspace.explore.modes.board')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{boardCards.filter((card) => card.status === 'shortlist').length} shortlisted activities</Badge>
                        <Badge variant="secondary">{boardCards.filter((card) => card.status === 'booked').length} booked activities</Badge>
                    </div>
                </CardContent>
            </Card>

            {mode === 'board' ? (
                <TripWorkspaceExploreBoard
                    trip={trip}
                    isMobile={isMobile}
                    cityFilter={boardCityFilter}
                    onCityFilterChange={setBoardCityFilter}
                    typeFilter={boardTypeFilter}
                    onTypeFilterChange={setBoardTypeFilter}
                    onOpenPlannerItem={onOpenPlannerItem}
                    onScheduleBoardCard={onScheduleBoardCard}
                    onUpdateActivityBoard={onUpdateActivityBoard}
                    onRemoveFromItinerary={onRemoveFromItinerary}
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <CardDescription>Discovery filters</CardDescription>
                            <CardTitle>Start with route pressure, then save what deserves board space</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                value={activeFilter}
                                onValueChange={(value) => {
                                    if (!value) return;
                                    setActiveFilter(value as DiscoveryFilter);
                                }}
                            >
                                {DISCOVERY_FILTERS.map((filter) => (
                                    <ToggleGroupItem key={filter} value={filter}>
                                        {filter === 'all' ? 'All leads' : `${filter.charAt(0).toUpperCase()}${filter.slice(1)}s`}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                            <Select value={activeCityId} onValueChange={setActiveCityId}>
                                <SelectTrigger className="h-10 md:max-w-sm">
                                    <SelectValue placeholder="Filter by city" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>City filters</SelectLabel>
                                        <SelectItem value="all">Entire route</SelectItem>
                                        {cityGuides.map((city) => (
                                            <SelectItem key={city.id} value={city.id}>
                                                {city.title}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
                        <Card className="border-border/80 bg-card/95 shadow-sm">
                            <CardHeader>
                                <CardDescription>Discovery leads</CardDescription>
                                <CardTitle>{filteredLeads.length} route-aware options</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3">
                                {filteredLeads.map((lead) => {
                                    const isActivity = lead.type === 'activity';
                                    const isSavedToBoard = isActivity && savedActivityLeadIds.has(lead.id);
                                    const isSavedLead = savedLeadIds.includes(lead.id);
                                    const showSavedState = isActivity ? isSavedToBoard : isSavedLead;

                                    return (
                                        <div key={lead.id} className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary">{lead.type}</Badge>
                                                <Badge variant="outline">{lead.reason}</Badge>
                                            </div>
                                            <p className="mt-3 text-lg font-semibold text-foreground">{lead.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.description}</p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    variant={showSavedState ? 'outline' : 'default'}
                                                    onClick={() => {
                                                        if (isActivity) {
                                                            handleSaveActivityLead(lead.id);
                                                            return;
                                                        }
                                                        setSavedLeadIds((current) => current.includes(lead.id)
                                                            ? current.filter((id) => id !== lead.id)
                                                            : [...current, lead.id]);
                                                        trackEvent('trip_workspace__explore_shortlist--toggle', {
                                                            trip_id: trip.id,
                                                            lead_id: lead.id,
                                                            active: !isSavedLead,
                                                        });
                                                    }}
                                                    {...getAnalyticsDebugAttributes(isActivity
                                                        ? 'trip_workspace__explore_activity_shortlist--create'
                                                        : 'trip_workspace__explore_shortlist--toggle', {
                                                        trip_id: trip.id,
                                                        lead_id: lead.id,
                                                        active: !showSavedState,
                                                    })}
                                                >
                                                    {showSavedState ? <CheckCircle data-icon="inline-start" weight="duotone" /> : <Sparkle data-icon="inline-start" weight="duotone" />}
                                                    {isActivity
                                                        ? showSavedState ? t('tripView.workspace.explore.openBoard') : 'Save to board'
                                                        : showSavedState ? 'Shortlisted' : 'Save to shortlist'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        trackEvent('trip_workspace__explore_link--open', {
                                                            trip_id: trip.id,
                                                            lead_id: lead.id,
                                                        });
                                                        openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(lead.query)}`);
                                                    }}
                                                    {...getAnalyticsDebugAttributes('trip_workspace__explore_link--open', {
                                                        trip_id: trip.id,
                                                        lead_id: lead.id,
                                                    })}
                                                >
                                                    <ArrowSquareOut data-icon="inline-start" weight="duotone" />
                                                    Research
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card className="border-border/80 bg-card/95 shadow-sm">
                                <CardHeader>
                                    <CardDescription>Saved from discovery</CardDescription>
                                    <CardTitle>{savedLeadIds.length + savedActivityLeadIds.size} leads worth revisiting</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-3">
                                    {THAILAND_EXPLORE_LEADS.filter((lead) => (
                                        (lead.type === 'activity' && savedActivityLeadIds.has(lead.id))
                                        || (lead.type !== 'activity' && savedLeadIds.includes(lead.id))
                                    )).map((lead) => (
                                        <div key={lead.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-medium text-foreground">{lead.title}</p>
                                                <Badge variant="outline">{lead.type}</Badge>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.reason}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                            <Card className="border-border/80 bg-card/95 shadow-sm">
                                <CardHeader>
                                    <CardDescription>Explore playground notes</CardDescription>
                                    <CardTitle>What changed with the board</CardTitle>
                                </CardHeader>
                                <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                                    <p>Activity discovery now has a proper workflow home, while stay and event ideas remain lightweight until live travel services arrive.</p>
                                    <p>Use the board when an activity is important enough to schedule, book, or mark done. Keep casual research in discovery so the planner does not turn into a dumping ground.</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="justify-start"
                                        onClick={() => {
                                            trackEvent('trip_workspace__explore_mode--change', {
                                                trip_id: trip.id,
                                                mode: 'board',
                                            });
                                            onModeChange('board');
                                        }}
                                    >
                                        <Stack data-icon="inline-start" weight="duotone" />
                                        {t('tripView.workspace.explore.openBoard')}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
