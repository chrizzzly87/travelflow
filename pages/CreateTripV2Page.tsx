import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Warning as AlertTriangle,
    CaretDown as ChevronDown,
    Compass,
    FilePlus,
    MapPin,
    SpinnerGap as Loader2,
    Sparkle as Sparkles,
    CalendarBlank,
    SlidersHorizontal,
    TextAlignLeft as AlignLeft,
    ArrowsClockwise,
    Globe,
    Sun,
    Clock,
    CaretUp as ChevronUp,
} from '@phosphor-icons/react';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { CountryTag } from '../components/CountryTag';
import { IdealTravelTimeline } from '../components/IdealTravelTimeline';
import { MonthSeasonStrip } from '../components/MonthSeasonStrip';
import { Checkbox } from '../components/ui/checkbox';
import { generateItinerary } from '../services/geminiService';
import { ITimelineItem, ITrip } from '../types';
import {
    addDays,
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationPromptLabel,
    getDestinationSeasonCountryName,
    generateTripId,
    getDefaultTripDates,
    getDaysDifference,
    isIslandDestination,
    resolveDestinationName,
    COUNTRIES,
} from '../utils';
import { createThailandTrip } from '../data/exampleTrips';
import { TripView } from '../components/TripView';
import { TripGenerationSkeleton } from '../components/TripGenerationSkeleton';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { SiteHeader } from '../components/navigation/SiteHeader';
import {
    getCommonBestMonths,
    getCountrySeasonByName,
    getDurationRecommendation,
    monthRangeBetweenDates,
    MONTH_LABELS,
} from '../data/countryTravelData';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface CreateTripV2PageProps {
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

const NOOP = () => {};

const toIsoDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatDateRange = (start: string, end: string): string => {
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    const fmt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString(undefined, fmt)} - ${e.toLocaleDateString(undefined, fmt)}`;
};

const GENERATION_MESSAGES = [
    'Analyzing your travel preferences...',
    'Scouting top-rated cities and stops...',
    'Calculating optimal travel routes...',
    'Structuring your daily timeline...',
    'Finalizing logistics and details...',
];

// ---------------------------------------------------------------------------
// Season quality helper
// ---------------------------------------------------------------------------

type SeasonQuality = 'great' | 'shoulder' | 'off';

function getSeasonQuality(seasonCountryNames: string[], startDate: string, endDate: string): { quality: SeasonQuality; label: string } | null {
    if (seasonCountryNames.length === 0 || !startDate || !endDate) return null;
    const commonMonths = getCommonBestMonths(seasonCountryNames);
    const travelMonths = monthRangeBetweenDates(startDate, endDate);
    if (travelMonths.length === 0 || (commonMonths.ideal.length === 0 && commonMonths.shoulder.length === 0)) return null;
    const idealOverlap = travelMonths.filter((m) => commonMonths.ideal.includes(m)).length;
    const shoulderOverlap = travelMonths.filter((m) => commonMonths.shoulder.includes(m)).length;
    const ratio = (idealOverlap + shoulderOverlap * 0.5) / travelMonths.length;
    if (ratio >= 0.6) return { quality: 'great', label: 'Great season' };
    if (ratio >= 0.3) return { quality: 'shoulder', label: 'Shoulder season' };
    return { quality: 'off', label: 'Off-season' };
}

const SEASON_COLOR: Record<SeasonQuality, string> = {
    great: 'text-green-600 bg-green-50 border-green-200',
    shoulder: 'text-amber-600 bg-amber-50 border-amber-200',
    off: 'text-red-600 bg-red-50 border-red-200',
};

const SEASON_DOT: Record<SeasonQuality, string> = {
    great: 'bg-green-500',
    shoulder: 'bg-amber-500',
    off: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Country Context Card (right panel)
// ---------------------------------------------------------------------------

const CountryContextCard: React.FC<{ countryName: string }> = ({ countryName }) => {
    const season = getCountrySeasonByName(getDestinationSeasonCountryName(countryName));
    const dest = getDestinationOptionByName(countryName);
    const fallback = COUNTRIES.find((c) => c.name === countryName);
    const flag = dest?.flag || season?.flag || fallback?.flag || '🌍';
    const durationRec = getDurationRecommendation([getDestinationSeasonCountryName(countryName)]);

    return (
        <div className="rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
            <div className="flex items-center gap-2.5 mb-3">
                <span className="text-2xl">{flag}</span>
                <div>
                    <div className="text-sm font-semibold text-gray-900">{countryName}</div>
                    {season?.climate && <div className="text-xs text-gray-500">{season.climate}</div>}
                </div>
            </div>

            {season && (
                <div className="mb-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">Season timeline</div>
                    <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                </div>
            )}

            <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">Suggested duration:</span> {durationRec.recommended} days ({durationRec.min}-{durationRec.max})
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateTripV2Page: React.FC<CreateTripV2PageProps> = ({ onTripGenerated, onOpenManager }) => {
    const defaultDates = getDefaultTripDates();

    // ---- Form state ----
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [isRoundTrip, setIsRoundTrip] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [specificCities, setSpecificCities] = useState('');
    const [budget, setBudget] = useState('Medium');
    const [pace, setPace] = useState('Balanced');
    const [numCities, setNumCities] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [enforceIslandOnly, setEnforceIslandOnly] = useState(true);

    // Mobile preview toggle
    const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

    // ---- Generation state ----
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [previewTrip, setPreviewTrip] = useState<ITrip | null>(null);
    const [loadingMessage, setLoadingMessage] = useState(GENERATION_MESSAGES[0]);
    const [generationSummary, setGenerationSummary] = useState<{ destination: string; startDate: string; endDate: string }>({
        destination: '',
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
    });

    // ---- Derived state ----
    const destination = selectedCountries.join(', ');
    const destinationPrompt = selectedCountries.map((c) => getDestinationPromptLabel(c)).join(', ');
    const seasonCountryNames = useMemo(() => {
        const seen = new Set<string>();
        return selectedCountries.map((c) => getDestinationSeasonCountryName(c)).filter((c) => {
            const key = c.toLocaleLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [selectedCountries]);
    const selectedIslandNames = useMemo(() => selectedCountries.filter((c) => isIslandDestination(c)), [selectedCountries]);
    const hasIslandSelection = selectedIslandNames.length > 0;
    const duration = getDaysDifference(startDate, endDate);
    const commonMonths = useMemo(() => getCommonBestMonths(seasonCountryNames), [seasonCountryNames]);
    const durationRec = useMemo(() => getDurationRecommendation(seasonCountryNames), [seasonCountryNames]);
    const seasonQuality = getSeasonQuality(seasonCountryNames, startDate, endDate);

    const hasDates = Boolean(startDate && endDate);
    const hasCountries = selectedCountries.length > 0;
    const showSummary = hasCountries && hasDates;

    // ---- Loading message rotation ----
    useEffect(() => {
        if (!isGenerating) return;
        setLoadingMessage(GENERATION_MESSAGES[0]);
        let index = 1;
        const interval = setInterval(() => {
            setLoadingMessage(GENERATION_MESSAGES[index % GENERATION_MESSAGES.length]);
            index += 1;
        }, 2200);
        return () => clearInterval(interval);
    }, [isGenerating]);

    useEffect(() => {
        if (hasIslandSelection) return;
        setEnforceIslandOnly(true);
    }, [hasIslandSelection]);

    // ---- Helpers ----
    const addCountry = useCallback((name: string) => {
        const resolved = resolveDestinationName(name);
        setSelectedCountries((prev) => (prev.includes(resolved) ? prev : [...prev, resolved]));
    }, []);

    const removeCountry = useCallback((name: string) => {
        setSelectedCountries((prev) => prev.filter((c) => c !== name));
    }, []);

    const buildPreviewTrip = (params: { destination: string; startDate: string; endDate: string; requestedStops?: number }): ITrip => {
        const now = Date.now();
        const totalDays = getDaysDifference(params.startDate, params.endDate);
        const stopCount = typeof params.requestedStops === 'number' ? Math.max(1, Math.round(params.requestedStops)) : Math.min(4, Math.max(2, Math.round(totalDays / 4)));
        const cityCount = Math.max(1, Math.min(stopCount, totalDays));
        const baseDuration = Math.floor(totalDays / cityCount);
        const remainder = totalDays % cityCount;
        let offset = 0;
        const items: ITimelineItem[] = Array.from({ length: cityCount }).map((_, i) => {
            const d = baseDuration + (i < remainder ? 1 : 0);
            const item: ITimelineItem = {
                id: `loading-city-${i}-${now}`,
                type: 'city',
                title: `Loading stop ${i + 1}`,
                startDateOffset: offset,
                duration: d,
                color: 'bg-slate-100 border-slate-200 text-slate-400',
                description: 'AI is generating this part of your itinerary.',
                location: params.destination || 'Destination',
                loading: true,
            };
            offset += d;
            return item;
        });
        return {
            id: `trip-preview-${now}`,
            title: `Planning ${params.destination || 'Trip'}...`,
            startDate: params.startDate,
            items,
            countryInfo: undefined,
            createdAt: now,
            updatedAt: now,
            isFavorite: false,
        };
    };

    const setGenerationStart = (params: { destination: string; startDate: string; endDate: string; requestedStops?: number }) => {
        setPreviewTrip(buildPreviewTrip(params));
        setGenerationSummary({ destination: params.destination, startDate: params.startDate, endDate: params.endDate });
        setIsGenerating(true);
        setGenerationError(null);
    };

    const setGenerationFailure = (error: unknown) => {
        setPreviewTrip(null);
        if (error instanceof Error) {
            setGenerationError(error.message || 'Failed to generate itinerary.');
        } else {
            setGenerationError('Failed to generate itinerary.');
        }
    };

    // ---- Generate ----
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        const primary = selectedCountries[0] || destination;
        setGenerationStart({ destination: primary, startDate, endDate, requestedStops: typeof numCities === 'number' ? numCities : undefined });

        try {
            const trip = await generateItinerary(destinationPrompt, startDate, {
                budget,
                pace,
                interests: notes.split(',').map((t) => t.trim()).filter(Boolean),
                specificCities,
                roundTrip: isRoundTrip,
                totalDays: duration,
                numCities: typeof numCities === 'number' ? numCities : undefined,
                selectedIslandNames,
                enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
            });
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error) {
            console.error('V2 generation failed:', error);
            setGenerationFailure(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateBlank = () => {
        const blankTrip: ITrip = {
            id: generateTripId(),
            title: `Trip to ${destination || 'Unknown'}`,
            startDate,
            items: [],
            countryInfo: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isFavorite: false,
        };
        onTripGenerated(blankTrip);
    };

    const fillExample = (dest: string, days: number, noteText: string) => {
        const resolved = resolveDestinationName(dest);
        setSelectedCountries(resolved ? [resolved] : []);
        const start = new Date();
        const end = addDays(start, days);
        setStartDate(toIsoDate(start));
        setEndDate(toIsoDate(end));
        setNotes(noteText);
    };

    // ---- Generation overlay ----
    if (isGenerating && previewTrip) {
        return (
            <div className="relative h-screen w-screen">
                <TripView
                    trip={previewTrip}
                    onUpdateTrip={setPreviewTrip}
                    onOpenManager={onOpenManager}
                    onOpenSettings={NOOP}
                    onViewSettingsChange={NOOP}
                    canShare={false}
                    initialMapFocusQuery={generationSummary.destination}
                />
                <div className="pointer-events-none absolute inset-0 z-[1800] flex items-center justify-center p-4 sm:p-6">
                    <div className="w-full max-w-xl rounded-2xl border border-accent-100 bg-white/95 shadow-xl backdrop-blur-sm px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center shrink-0">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-accent-900 truncate">Planning Your Trip</div>
                                <div className="text-xs text-gray-600 truncate">{loadingMessage}</div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-500">
                            {generationSummary.destination || 'Destination'} • {formatDateRange(generationSummary.startDate, generationSummary.endDate)} • {getDaysDifference(generationSummary.startDate, generationSummary.endDate)} days
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full w-1/2 bg-gradient-to-r from-accent-500 to-accent-600 animate-pulse rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isGenerating) {
        return <TripGenerationSkeleton />;
    }

    // ---- Mobile summary bar text ----
    const mobileSummary = hasCountries
        ? `${selectedCountries.join(', ')}${hasDates ? ` - ${duration} days` : ''}${seasonQuality ? ` - ${seasonQuality.label}` : ''}`
        : 'Trip Preview';

    // ---- Right panel content ----
    const renderRightPanel = () => (
        <div className="space-y-4">
            {!hasCountries && (
                <div className="flex flex-col items-center justify-center text-center py-16 text-gray-400">
                    <Compass size={48} weight="duotone" className="mb-3 text-gray-300" />
                    <div className="text-sm font-medium text-gray-500">Start adding destinations</div>
                    <div className="text-xs text-gray-400 mt-1">Country info and season insights will appear here</div>
                </div>
            )}

            {hasCountries && selectedCountries.map((c) => (
                <CountryContextCard key={c} countryName={c} />
            ))}

            {hasDates && seasonQuality && (
                <div className={`rounded-2xl border p-4 ${SEASON_COLOR[seasonQuality.quality]}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${SEASON_DOT[seasonQuality.quality]}`} />
                        {seasonQuality.label}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                        {formatDateRange(startDate, endDate)} ({duration} days)
                    </div>
                </div>
            )}

            {hasCountries && (commonMonths.ideal.length > 0 || commonMonths.shoulder.length > 0) && (
                <div className="rounded-2xl border border-gray-100 bg-white/80 backdrop-blur-sm p-4 shadow-sm">
                    <div className="text-xs font-medium text-gray-600 mb-2">Best months across destinations</div>
                    <MonthSeasonStrip idealMonths={commonMonths.ideal} shoulderMonths={commonMonths.shoulder} />
                </div>
            )}

            {showSummary && (
                <div className="rounded-2xl border border-accent-100 bg-accent-50/50 backdrop-blur-sm p-4 shadow-sm">
                    <div className="text-xs font-semibold text-accent-700 uppercase tracking-wider mb-2">Trip Summary</div>
                    <div className="space-y-1.5 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                            <Globe size={14} className="text-accent-500" />
                            <span>{selectedCountries.length} destination{selectedCountries.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarBlank size={14} className="text-accent-500" />
                            <span>{duration} days</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-accent-500" />
                            <span>Recommended: {durationRec.recommended} days ({durationRec.min}-{durationRec.max})</span>
                        </div>
                        {duration < durationRec.min && (
                            <div className="text-xs text-amber-600 mt-1">
                                Your trip is shorter than the recommended minimum. Consider adding more days.
                            </div>
                        )}
                        {duration > durationRec.max && (
                            <div className="text-xs text-amber-600 mt-1">
                                Your trip is longer than the recommended maximum. You might have time for additional destinations.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // ---- Main render ----
    return (
        <div className="w-full min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-accent-50/30">
            <SiteHeader variant="glass" hideCreateTrip onMyTripsClick={onOpenManager} />

            {/* Mobile preview bar (< lg) */}
            {hasCountries && (
                <div className="lg:hidden sticky top-[57px] z-30">
                    <button
                        type="button"
                        onClick={() => setMobilePreviewOpen(!mobilePreviewOpen)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white/90 backdrop-blur-md border-b border-gray-200 text-sm"
                    >
                        <span className="truncate text-gray-700 font-medium">{mobileSummary}</span>
                        {mobilePreviewOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                    </button>
                    {mobilePreviewOpen && (
                        <div className="max-h-[50vh] overflow-y-auto bg-white/95 backdrop-blur-md border-b border-gray-200 p-4">
                            {renderRightPanel()}
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 flex">
                {/* ---- LEFT PANEL: Form ---- */}
                <div className="w-full lg:w-[48%] h-auto lg:h-[calc(100vh-57px)] lg:sticky lg:top-[57px] overflow-y-auto">
                    <form onSubmit={handleGenerate} className="p-5 sm:p-8 max-w-xl mx-auto lg:mx-0 lg:ml-auto lg:mr-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Trip Details
                        </h1>
                        <p className="text-sm text-gray-500 mb-6">Build your trip step by step.</p>

                        {/* Destination */}
                        <div className="pb-5 mb-5 border-b border-gray-100">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                <span className="flex items-center gap-1.5"><MapPin size={13} weight="duotone" className="text-accent-500" /> Destinations</span>
                            </label>
                            <CountrySelect
                                selectedCountries={selectedCountries}
                                onAdd={addCountry}
                                onRemove={removeCountry}
                            />
                            {selectedCountries.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedCountries.map((c) => {
                                        const dest = getDestinationOptionByName(c);
                                        const season = getCountrySeasonByName(getDestinationSeasonCountryName(c));
                                        const fb = COUNTRIES.find((x) => x.name === c);
                                        return (
                                            <CountryTag
                                                key={c}
                                                countryName={c}
                                                flag={dest?.flag || season?.flag || fb?.flag || '🌍'}
                                                metaLabel={getDestinationMetaLabel(c)}
                                                removable
                                                onRemove={() => removeCountry(c)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Route */}
                        <div className="pb-5 mb-5 border-b border-gray-100">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                <span className="flex items-center gap-1.5"><ArrowsClockwise size={13} weight="duotone" className="text-accent-500" /> Route</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <Checkbox checked={isRoundTrip} onCheckedChange={(v) => setIsRoundTrip(!!v)} />
                                <span>Round trip (return to starting city)</span>
                            </label>
                        </div>

                        {/* Dates */}
                        <div className="pb-5 mb-5 border-b border-gray-100">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                <span className="flex items-center gap-1.5"><CalendarBlank size={13} weight="duotone" className="text-accent-500" /> Dates</span>
                            </label>
                            <DateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onStartDateChange={setStartDate}
                                onEndDateChange={setEndDate}
                            />
                            <div className="mt-2 flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-accent-50 border border-accent-100 px-2.5 py-0.5 text-xs font-medium text-accent-700">
                                    {duration} days
                                </span>
                            </div>
                        </div>

                        {/* Advanced */}
                        <div className="pb-5 mb-5 border-b border-gray-100">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 w-full"
                            >
                                <SlidersHorizontal size={13} weight="duotone" className="text-accent-500" />
                                <span>Advanced Options</span>
                                <ChevronDown size={14} className={`ml-auto text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                            </button>

                            {showAdvanced && (
                                <div className="mt-3 space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Specific cities</label>
                                        <input
                                            type="text"
                                            value={specificCities}
                                            onChange={(e) => setSpecificCities(e.target.value)}
                                            placeholder="e.g. Rome, Florence, Venice"
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Budget</label>
                                            <select value={budget} onChange={(e) => setBudget(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none">
                                                <option>Budget</option>
                                                <option>Medium</option>
                                                <option>Premium</option>
                                                <option>Luxury</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Pace</label>
                                            <select value={pace} onChange={(e) => setPace(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none">
                                                <option>Relaxed</option>
                                                <option>Balanced</option>
                                                <option>Intensive</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Stops</label>
                                            <input type="number" min={1} max={20} value={numCities} onChange={(e) => setNumCities(e.target.value ? parseInt(e.target.value, 10) : '')} placeholder="Auto" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none" />
                                        </div>
                                    </div>
                                    {hasIslandSelection && (
                                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                            <Checkbox checked={enforceIslandOnly} onCheckedChange={(v) => setEnforceIslandOnly(!!v)} />
                                            <span>Island-only planning</span>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div className="pb-5 mb-5 border-b border-gray-100">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                                <span className="flex items-center gap-1.5"><AlignLeft size={13} weight="duotone" className="text-accent-500" /> Notes</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Anything else? Food preferences, must-see spots, companions..."
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none resize-none"
                            />
                        </div>

                        {/* Error */}
                        {generationError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>{generationError}</span>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <button
                                type="submit"
                                disabled={selectedCountries.length === 0 || isGenerating}
                                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={16} weight="fill" />
                                Generate Trip
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBlank}
                                disabled={selectedCountries.length === 0}
                                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FilePlus size={16} />
                                Create Blank
                            </button>
                        </div>

                        {/* Quick examples */}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            <button type="button" className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm" onClick={() => fillExample('Italy', 14, 'Rome, Florence, Venice. Art & Food.')}>
                                🇮🇹 2 Weeks in Italy
                            </button>
                            <button type="button" className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm" onClick={() => fillExample('Japan', 7, 'Anime, Tech, and Sushi.')}>
                                🇯🇵 7 Days in Japan
                            </button>
                            <button type="button" className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm" onClick={() => onTripGenerated(createThailandTrip(new Date().toISOString()))}>
                                🇹🇭 Thailand (Test Plan)
                            </button>
                        </div>
                    </form>
                </div>

                {/* ---- RIGHT PANEL: Preview ---- */}
                <div className="hidden lg:block lg:w-[52%] h-[calc(100vh-57px)] sticky top-[57px] overflow-y-auto border-l border-gray-100">
                    <div className="p-6 xl:p-8">
                        <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Trip Preview
                        </h2>
                        {renderRightPanel()}
                    </div>
                </div>
            </div>

            <SiteFooter />
        </div>
    );
};
