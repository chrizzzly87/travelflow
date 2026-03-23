import React from 'react';
import { ArrowSquareOut, CheckCircle, Compass, Sparkle, Stack } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

import type {
    ActivityType,
    ITrip,
    ITripActivityBoardCard,
    TripWorkspaceContextSelection,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    getTripWorkspaceCityItem,
    type TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';
import { resolveTripWorkspaceContextSnapshot } from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { createExploreLeadBoardCard, deriveTripActivityBoardCards } from './tripActivityBoard';
import { TripWorkspaceExploreBoard } from './TripWorkspaceExploreBoard';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
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

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceExplorePageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
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
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
    isMobile,
    mode,
    onModeChange,
    onOpenPlannerItem,
    onUpdateActivityBoard,
    onScheduleBoardCard,
    onRemoveFromItinerary,
}) => {
    const { t } = useTranslation('common');
    const pageTripMeta = React.useMemo(
        () => tripMeta ?? resolveTripWorkspaceFallbackTripMeta(trip),
        [trip, tripMeta],
    );
    const {
        dataset: pageDataset,
        contextSelection: pageContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    } = useTripWorkspacePageContext({
        trip,
        dataset,
        contextSelection,
        onContextSelectionChange,
    });
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const isBoardMode = mode === 'board';
    const [activeFilter, setActiveFilter] = React.useState<DiscoveryFilter>('all');
    const [activeCityId, setActiveCityId] = React.useState<string>('all');
    const [boardCityFilter, setBoardCityFilter] = React.useState<string>('all');
    const [boardTypeFilter, setBoardTypeFilter] = React.useState<'all' | ActivityType>('all');
    const [savedLeadIds, setSavedLeadIds] = React.useState<string[]>([]);
    const boardCards = React.useMemo(() => deriveTripActivityBoardCards(trip), [trip]);
    const savedActivityLeadIds = React.useMemo(() => new Set(
        boardCards
            .filter((card) => card.source === 'explore')
            .map((card) => card.id.replace(/^explore-/, '')),
    ), [boardCards]);

    React.useEffect(() => {
        setActiveCityId(context.activeCity?.id ?? 'all');
    }, [context.activeCity?.id]);

    const countryLeads = React.useMemo(
        () => pageDataset.exploreLeads.filter((lead) => !context.activeCountry || lead.countryCode === context.activeCountry.code),
        [context.activeCountry, pageDataset.exploreLeads],
    );
    const filteredLeads = React.useMemo(() => countryLeads.filter((lead) => {
        if (activeFilter !== 'all' && lead.type !== activeFilter) return false;
        if (activeCityId !== 'all' && lead.cityId !== activeCityId) return false;
        return true;
    }), [activeCityId, activeFilter, countryLeads]);

    const handleSaveActivityLead = React.useCallback((leadId: string) => {
        const lead = pageDataset.exploreLeads.find((candidate) => candidate.id === leadId && candidate.type === 'activity');
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
    }, [boardCards, onModeChange, onUpdateActivityBoard, pageDataset.exploreLeads, savedActivityLeadIds, trip]);

    return (
        <div className="flex flex-col gap-4">
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="explore"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            {isBoardMode ? (
                <Card className="border-border/70 bg-card shadow-sm">
                    <CardContent className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'discover' | 'board')}>
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
                            <Badge variant="outline">{context.activeCountry?.name ?? 'Route'} board</Badge>
                            <Badge variant="secondary">{boardCards.filter((card) => card.status === 'booked').length} booked</Badge>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-border/80 bg-card/95 shadow-sm">
                    <CardHeader className="gap-3">
                        <CardDescription>Route-aware discovery and workflow</CardDescription>
                        <CardTitle>Research what fits in {context.activeCountry?.name ?? 'this country'}, then move strong ideas through the trip</CardTitle>
                        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                            Explore stays grouped by the active country and city context, while the board keeps only the activities that deserve ongoing workflow attention.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                        <Tabs value={mode} onValueChange={(value) => onModeChange(value as 'discover' | 'board')}>
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
                            <Badge variant="outline">{context.activeCountry?.name ?? 'Route'} discovery</Badge>
                            <Badge variant="outline">{countryLeads.length} leads in this country</Badge>
                            <Badge variant="secondary">{boardCards.filter((card) => card.status === 'booked').length} booked activities</Badge>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                            <CardTitle>Start with country context, then narrow to city and lead type</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{context.activeCountry?.name ?? 'Route'}</Badge>
                                <Badge variant="outline">{context.activeCity?.title ?? 'Current city'}</Badge>
                            </div>
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
                                        <SelectItem value="all">Entire {context.activeCountry?.name ?? 'route'} leg</SelectItem>
                                        {context.countryCities.map((city) => (
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
                                                <Badge variant="outline">
                                                    {pageDataset.cities.find((city) => city.id === lead.cityId)?.title ?? lead.cityId}
                                                </Badge>
                                            </div>
                                            <p className="mt-3 text-sm font-medium text-foreground">{lead.title}</p>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{lead.description}</p>
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {isActivity ? (
                                                    <Button
                                                        type="button"
                                                        variant={showSavedState ? 'outline' : 'default'}
                                                        onClick={() => handleSaveActivityLead(lead.id)}
                                                        {...getAnalyticsDebugAttributes('trip_workspace__explore_activity_shortlist--create', {
                                                            trip_id: trip.id,
                                                            lead_id: lead.id,
                                                        })}
                                                    >
                                                        {showSavedState ? (
                                                            <>
                                                                <CheckCircle data-icon="inline-start" weight="duotone" />
                                                                Open in board
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkle data-icon="inline-start" weight="duotone" />
                                                                Save to board
                                                            </>
                                                        )}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant={showSavedState ? 'outline' : 'default'}
                                                        onClick={() => setSavedLeadIds((current) => current.includes(lead.id)
                                                            ? current.filter((id) => id !== lead.id)
                                                            : [...current, lead.id])}
                                                    >
                                                        {showSavedState ? 'Saved' : 'Save lead'}
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(lead.query)}`)}
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

                        <Card className="border-border/80 bg-card/95 shadow-sm">
                            <CardHeader>
                                <CardDescription>Why this page exists</CardDescription>
                                <CardTitle>Explore separates discovery from commitment</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                                <p>Country context sits above city-specific leads, so a multi-country route does not feel like one undifferentiated list of ideas.</p>
                                <p>Only activities graduate into the board. Stays and events can stay in discovery until they deserve more workflow attention.</p>
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <p className="text-sm font-medium text-foreground">Current country</p>
                                    <p className="mt-2">{context.activeCountry?.name ?? 'Route'} is the active discovery layer, with {context.countryCities.length} city guide{context.countryCities.length === 1 ? '' : 's'} available below it.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};
