import React from 'react';
import {
    Backpack,
    CalendarBlank,
    CloudArrowDown,
    CloudSun,
    GlobeHemisphereWest,
    Lifebuoy,
    SuitcaseRolling,
    Waves,
    Wind,
} from '@phosphor-icons/react';

import type { ITrip, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_WEATHER_STOPS,
    type TripWorkspaceWeatherLensId,
    getTripWorkspaceCityGuide,
    resolveTripWorkspaceCityStops,
} from './tripWorkspaceDemoData';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';

interface TripWorkspaceWeatherPageProps {
    trip: ITrip;
    onPageChange: (page: TripWorkspacePage) => void;
}

const LENS_COPY: Record<TripWorkspaceWeatherLensId, { label: string; title: string; description: string }> = {
    feel: {
        label: 'Travel feel',
        title: 'How the day will actually feel on foot',
        description: 'Use this when you care more about pace, comfort, and timing than raw forecast numbers.',
    },
    rain: {
        label: 'Rain risk',
        title: 'Where showers change the route rather than just the mood',
        description: 'The question is not “will it rain?” but “which part of the plan becomes weaker when it does?”',
    },
    sea: {
        label: 'Sea watch',
        title: 'Where marine conditions start reshaping the coast leg',
        description: 'This matters most once the trip depends on boats, viewpoints, and flexible transfer timing.',
    },
    pack: {
        label: 'Pack notes',
        title: 'What to keep reachable without overpacking',
        description: 'Use this lens to decide the small items that reduce friction once the weather turns real.',
    },
};

const QuickWeatherLink: React.FC<{
    icon: React.ReactNode;
    label: string;
    page: TripWorkspacePage;
    tripId: string;
    onPageChange: (page: TripWorkspacePage) => void;
}> = ({ icon, label, page, tripId, onPageChange }) => (
    <Button
        type="button"
        variant="outline"
        onClick={() => {
            trackEvent('trip_workspace__weather_link--open', {
                trip_id: tripId,
                target_page: page,
            });
            onPageChange(page);
        }}
        {...getAnalyticsDebugAttributes('trip_workspace__weather_link--open', {
            trip_id: tripId,
            target_page: page,
        })}
    >
        {icon}
        {label}
    </Button>
);

export const TripWorkspaceWeatherPage: React.FC<TripWorkspaceWeatherPageProps> = ({
    trip,
    onPageChange,
}) => {
    const cityStops = React.useMemo(() => resolveTripWorkspaceCityStops(trip.items), [trip.items]);
    const routeWeatherStops = React.useMemo(() => cityStops
        .map((stop) => {
            const guide = getTripWorkspaceCityGuide(stop.title);
            if (!guide) return null;
            return THAILAND_WEATHER_STOPS.find((entry) => entry.id === guide.id) ?? null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)), [cityStops]);

    const [activeStopId, setActiveStopId] = React.useState<string>(() => routeWeatherStops[0]?.id ?? THAILAND_WEATHER_STOPS[0].id);
    const [activeLens, setActiveLens] = React.useState<TripWorkspaceWeatherLensId>('feel');

    React.useEffect(() => {
        if (!routeWeatherStops.some((stop) => stop.id === activeStopId)) {
            setActiveStopId(routeWeatherStops[0]?.id ?? THAILAND_WEATHER_STOPS[0].id);
        }
    }, [activeStopId, routeWeatherStops]);

    const activeStop = routeWeatherStops.find((stop) => stop.id === activeStopId) ?? routeWeatherStops[0] ?? THAILAND_WEATHER_STOPS[0];
    const activeLensCopy = LENS_COPY[activeLens];

    const lensBody = React.useMemo(() => {
        switch (activeLens) {
            case 'rain':
                return activeStop.caution;
            case 'sea':
                return activeStop.seaNote;
            case 'pack':
                return activeStop.packNotes.join(' • ');
            case 'feel':
            default:
                return activeStop.travelFeel;
        }
    }, [activeLens, activeStop]);

    return (
        <div className="flex flex-col gap-4">
            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-sky-50 via-background to-cyan-50 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Demo weather layer</Badge>
                        <Badge variant="outline">Route conditions</Badge>
                        <Badge variant="outline">{activeStop.updateLine}</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div>
                            <CardDescription>Weather pulse</CardDescription>
                            <CardTitle>{activeStop.title} is the condition hinge for this part of the route</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Weather should help decide timing, buffers, and backups, not just decorate the dashboard.
                                This page keeps the route-aware version visible so you can tell when a great day needs an earlier start or an inland fallback.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <QuickWeatherLink icon={<GlobeHemisphereWest data-icon="inline-start" weight="duotone" />} label="Open places" page="places" tripId={trip.id} onPageChange={onPageChange} />
                                <QuickWeatherLink icon={<Backpack data-icon="inline-start" weight="duotone" />} label="Open travel kit" page="travel-kit" tripId={trip.id} onPageChange={onPageChange} />
                                <QuickWeatherLink icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {activeStop.signals.map((signal) => (
                                <div key={signal.label} className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{signal.label}</p>
                                    <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{signal.value}</p>
                                    <Badge variant={signal.tone} className="mt-3">{activeStop.title}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-col gap-3">
                                <div>
                                    <CardDescription>Route stops</CardDescription>
                                    <CardTitle>Switch the weather view by stop, not by generic city card</CardTitle>
                                </div>
                                <ToggleGroup
                                    type="single"
                                    value={activeStopId}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setActiveStopId(value);
                                        trackEvent('trip_workspace__weather_stop--select', {
                                            trip_id: trip.id,
                                            stop_id: value,
                                        });
                                    }}
                                    variant="outline"
                                    className="flex w-full flex-wrap gap-2"
                                >
                                    {routeWeatherStops.map((stop) => (
                                        <ToggleGroupItem
                                            key={stop.id}
                                            value={stop.id}
                                            className="rounded-full"
                                            {...getAnalyticsDebugAttributes('trip_workspace__weather_stop--select', {
                                                trip_id: trip.id,
                                                stop_id: stop.id,
                                            })}
                                        >
                                            {stop.title}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-start gap-3">
                                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700">
                                        <CloudSun size={22} weight="duotone" />
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{activeStop.headline}</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeStop.activityWindow}</p>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <CardDescription>Condition lens</CardDescription>
                                    <CardTitle>Read the same stop through the decision that matters right now</CardTitle>
                                </div>
                                <ToggleGroup
                                    type="single"
                                    value={activeLens}
                                    onValueChange={(value) => {
                                        if (!value) return;
                                        setActiveLens(value as TripWorkspaceWeatherLensId);
                                        trackEvent('trip_workspace__weather_lens--select', {
                                            trip_id: trip.id,
                                            lens: value,
                                        });
                                    }}
                                    variant="outline"
                                    className="flex w-full flex-wrap gap-2 lg:w-auto"
                                >
                                    {Object.entries(LENS_COPY).map(([value, entry]) => (
                                        <ToggleGroupItem
                                            key={value}
                                            value={value}
                                            className="rounded-full"
                                            {...getAnalyticsDebugAttributes('trip_workspace__weather_lens--select', {
                                                trip_id: trip.id,
                                                lens: value,
                                            })}
                                        >
                                            {entry.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <p className="text-sm font-medium text-foreground">{activeLensCopy.title}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeLensCopy.description}</p>
                                <p className="mt-4 text-sm leading-6 text-foreground">{lensBody}</p>
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            {activeStop.forecast.map((day) => (
                                <div key={day.label} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{day.label}</p>
                                            <p className="mt-2 text-lg font-semibold text-foreground">{day.tempC}</p>
                                        </div>
                                        <Badge variant="outline">{day.rainChance} rain</Badge>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{day.condition}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Activity window</CardDescription>
                            <CardTitle>Timing matters more than forecast obsession</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <Wind size={18} weight="duotone" className="text-sky-700" />
                                    <p className="text-sm font-medium text-foreground">Best movement window</p>
                                </div>
                                <p className="mt-2">{activeStop.activityWindow}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <Waves size={18} weight="duotone" className="text-cyan-700" />
                                    <p className="text-sm font-medium text-foreground">Sea note</p>
                                </div>
                                <p className="mt-2">{activeStop.seaNote}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <CloudArrowDown size={18} weight="duotone" className="text-indigo-700" />
                                    <p className="text-sm font-medium text-foreground">Fallback signal</p>
                                </div>
                                <p className="mt-2">{activeStop.caution}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Pack notes</CardDescription>
                            <CardTitle>Small weather prep beats dragging a huge bag through every stop</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            {activeStop.packNotes.map((note) => (
                                <div key={note} className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <Backpack size={18} weight="duotone" className="text-emerald-700" />
                                        <p className="text-sm leading-6 text-foreground">{note}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Why this page belongs in the workspace</CardDescription>
                            <CardTitle>Weather only matters if it changes what you do next</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <p>
                                The point is not to pin a perfect forecast to every city. The point is to see when weather changes timing,
                                transport confidence, or which version of the day will feel best.
                            </p>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Lifebuoy size={18} weight="duotone" className="text-accent-700" />
                                    <p className="text-sm font-medium text-foreground">Weather should buy you a better fallback, not just a prettier widget.</p>
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <SuitcaseRolling size={18} weight="duotone" className="text-amber-700" />
                                    <p className="text-sm font-medium text-foreground">In Thailand, the south leg is where a soft plan is usually smarter than a rigid one.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
