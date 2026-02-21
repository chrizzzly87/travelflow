import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Warning as AlertTriangle,
    Check,
    CaretDown as ChevronDown,
    Compass,
    FilePlus,
    MapPin,
    SpinnerGap as Loader2,
    Sparkle as Sparkles,
    CalendarBlank,
    SlidersHorizontal,
    TextAlignLeft as AlignLeft,
    Sun,
    TreePalm,
} from '@phosphor-icons/react';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { CountryTag } from '../components/CountryTag';
import { IdealTravelTimeline } from '../components/IdealTravelTimeline';
import { MonthSeasonStrip } from '../components/MonthSeasonStrip';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../components/ui/select';
import { generateItinerary, generateWizardItinerary } from '../services/geminiService';
import { ITimelineItem, ITrip, TripPrefillData } from '../types';
import {
    addDays,
    generateTripId,
    getDefaultTripDates,
    getDaysDifference,
    COUNTRIES,
    encodeTripPrefill,
} from '../utils';
import {
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationPromptLabel,
    getDestinationSeasonCountryName,
    isIslandDestination,
    resolveDestinationName,
} from '../services/destinationService';
import { decodeTripPrefill } from '../services/tripPrefillDecoder';
import { createThailandTrip } from '../data/exampleTrips';
import { TripView } from '../components/TripView';
import { TripGenerationSkeleton } from '../components/TripGenerationSkeleton';
import { HeroWebGLBackground } from '../components/HeroWebGLBackground';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { FlagIcon } from '../components/flags/FlagIcon';
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

interface CreateTripV1PageProps {
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

const monthLabelsFromNumbers = (months: number[]): string[] =>
    months.filter((month) => month >= 1 && month <= 12).map((month) => MONTH_LABELS[month - 1]);

const GENERATION_MESSAGES = [
    'Analyzing your travel preferences...',
    'Scouting top-rated cities and stops...',
    'Calculating optimal travel routes...',
    'Structuring your daily timeline...',
    'Finalizing logistics and details...',
];

// ---------------------------------------------------------------------------
// Wizard card data (borrowed from CreateTripForm)
// ---------------------------------------------------------------------------

interface SelectionCardConfig {
    id: string;
    title: string;
    description: string;
    emoji?: string;
}

const STYLE_CARDS: SelectionCardConfig[] = [
    { id: 'first-timer', title: 'First-Timer', description: 'Easy logistics, iconic highlights.', emoji: '🧭' },
    { id: 'backpacker', title: 'Backpacker', description: 'Budget-minded, flexible experiences.', emoji: '🎒' },
    { id: 'slow-travel', title: 'Slow Travel', description: 'Fewer moves, deeper local immersion.', emoji: '🐢' },
    { id: 'comfort-explorer', title: 'Comfort Explorer', description: 'Balanced pace, convenient transitions.', emoji: '🛋️' },
];

const VIBE_CARDS: SelectionCardConfig[] = [
    { id: 'food', title: 'Food & Markets', emoji: '🍜' },
    { id: 'culture', title: 'Culture & History', emoji: '🏛️' },
    { id: 'nature', title: 'Nature & Scenic', emoji: '🏞️' },
    { id: 'adventure', title: 'Adventure', emoji: '🥾' },
    { id: 'relaxation', title: 'Relaxation', emoji: '🌴' },
    { id: 'nightlife', title: 'Nightlife', emoji: '🌃' },
];

// ---------------------------------------------------------------------------
// Season quality helper
// ---------------------------------------------------------------------------

type SeasonQuality = 'great' | 'shoulder' | 'off';

function getSeasonQuality(selectedCountries: string[], startDate: string, endDate: string): { quality: SeasonQuality; label: string } | null {
    if (selectedCountries.length === 0 || !startDate || !endDate) return null;
    const seasonCountryNames = [...new Set(selectedCountries.map((c) => getDestinationSeasonCountryName(c)))];
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

const SEASON_DOT: Record<SeasonQuality, string> = {
    great: 'bg-green-500',
    shoulder: 'bg-amber-500',
    off: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

const SectionHeader: React.FC<{ number: number; icon: React.ReactNode; label: string }> = ({ number, icon, label }) => (
    <div className="flex items-center gap-2.5 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xs font-bold">{number}</span>
        <span className="text-accent-600">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</span>
    </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateTripV1Page: React.FC<CreateTripV1PageProps> = ({ onTripGenerated, onOpenManager }) => {
    const [searchParams] = useSearchParams();
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
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

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
    const durationRec = useMemo(() => getDurationRecommendation(seasonCountryNames, selectedStyles), [seasonCountryNames, selectedStyles]);
    const seasonQuality = getSeasonQuality(selectedCountries, startDate, endDate);

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

    // ---- Prefill from URL ----
    useEffect(() => {
        const raw = searchParams.get('prefill');
        if (!raw) return;
        const data = decodeTripPrefill(raw);
        if (!data) return;
        if (data.countries?.length) setSelectedCountries(data.countries);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.budget) setBudget(data.budget);
        if (data.pace) setPace(data.pace);
        if (data.cities) setSpecificCities(data.cities);
        if (data.notes) setNotes(data.notes);
        if (typeof data.roundTrip === 'boolean') setIsRoundTrip(data.roundTrip);
        if (data.styles) setSelectedStyles(data.styles);
        if (data.vibes) setSelectedVibes(data.vibes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- Build variant URL with current state ----
    const buildVariantUrl = useCallback((path: string) => {
        const data: TripPrefillData = {};
        if (selectedCountries.length) data.countries = selectedCountries;
        if (startDate !== defaultDates.startDate) data.startDate = startDate;
        if (endDate !== defaultDates.endDate) data.endDate = endDate;
        if (budget !== 'Medium') data.budget = budget;
        if (pace !== 'Balanced') data.pace = pace;
        if (specificCities) data.cities = specificCities;
        if (notes) data.notes = notes;
        if (!isRoundTrip) data.roundTrip = false;
        if (selectedStyles.length) data.styles = selectedStyles;
        if (selectedVibes.length) data.vibes = selectedVibes;
        if (Object.keys(data).length === 0) return path;
        return `${path}?prefill=${encodeTripPrefill(data)}`;
    }, [selectedCountries, startDate, endDate, budget, pace, specificCities, notes, isRoundTrip, selectedStyles, selectedVibes, defaultDates]);

    // ---- Helpers ----
    const setCountriesFromString = useCallback((value: string) => {
        setSelectedCountries(value ? value.split(',').map((s) => resolveDestinationName(s.trim())).filter(Boolean) : []);
    }, []);

    const removeCountry = useCallback((name: string) => {
        setSelectedCountries((prev) => prev.filter((c) => c !== name));
    }, []);

    const toggleChip = (current: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    };

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

        const hasStyleVibeContext = selectedStyles.length > 0 || selectedVibes.length > 0;

        try {
            let trip: ITrip;
            if (hasStyleVibeContext) {
                trip = await generateWizardItinerary({
                    countries: selectedCountries.map((c) => getDestinationPromptLabel(c)),
                    startDate,
                    endDate,
                    roundTrip: isRoundTrip,
                    totalDays: duration,
                    notes,
                    travelStyles: selectedStyles,
                    travelVibes: selectedVibes,
                    travelLogistics: [],
                    idealMonths: monthLabelsFromNumbers(commonMonths.ideal),
                    shoulderMonths: monthLabelsFromNumbers(commonMonths.shoulder),
                    recommendedDurationDays: durationRec.recommended,
                    selectedIslandNames,
                    enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
                });
            } else {
                trip = await generateItinerary(destinationPrompt, startDate, {
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
            }
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error) {
            console.error('V1 generation failed:', error);
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

    // ---- Main render ----
    return (
        <div className="w-full min-h-screen flex flex-col relative isolate overflow-hidden bg-slate-50">
            <HeroWebGLBackground className="z-0" />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-white/25" />
            <div className="pointer-events-none absolute -left-24 top-20 z-[1] h-72 w-72 rounded-full bg-accent-200/30 blur-[80px]" />
            <div className="pointer-events-none absolute -right-10 bottom-20 z-[1] h-80 w-80 rounded-full bg-accent-300/30 blur-[80px]" />

            <div className="relative z-20">
                <SiteHeader variant="glass" hideCreateTrip onMyTripsClick={onOpenManager} />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center p-4 pt-6 sm:pt-8 md:pt-10 overflow-y-auto w-full">
                {/* Hero heading */}
                <div className="text-center mb-6 animate-hero-entrance" style={{ '--stagger': 0 } as React.CSSProperties}>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Design your perfect trip
                    </h1>
                    <p className="text-gray-500 text-sm sm:text-base">All-in-one form with smart season insights and style preferences.</p>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-gray-400">
                        <span>Variants:</span>
                        <span className="font-medium text-accent-600">V1</span>
                        <Link to={buildVariantUrl('/create-trip/v2')} className="underline hover:text-accent-600 transition-colors">V2 Split-Screen</Link>
                        <Link to={buildVariantUrl('/create-trip/v3')} className="underline hover:text-accent-600 transition-colors">V3 Journey</Link>
                        <span className="text-gray-300">|</span>
                        <Link to={buildVariantUrl('/create-trip')} className="underline hover:text-accent-600 transition-colors">Main</Link>
                    </div>
                </div>

                {/* Main card */}
                <form
                    onSubmit={handleGenerate}
                    className="bg-white/90 backdrop-blur-md p-5 sm:p-7 rounded-3xl shadow-2xl ring-1 ring-slate-900/5 border border-gray-100 w-full max-w-2xl relative overflow-visible mx-3"
                >
                    {/* Accent gradient top bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 rounded-t-3xl bg-gradient-to-r from-accent-500 via-accent-600 to-accent-700 shadow-[0_1px_8px_rgb(var(--tf-accent-rgb)/0.3)]" />

                    <div className="space-y-5 pt-2">
                        {/* ---- Section 1: Destinations ---- */}
                        <div
                            className="rounded-2xl border border-gray-100 bg-gray-50/60 backdrop-blur-sm p-4 animate-hero-stagger"
                            style={{ '--stagger': 1 } as React.CSSProperties}
                        >
                            <SectionHeader number={1} icon={<MapPin size={15} weight="duotone" />} label="Destinations" />
                            <CountrySelect
                                value={destination}
                                onChange={setCountriesFromString}
                            />

                            {selectedCountries.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {selectedCountries.map((c) => {
                                        const dest = getDestinationOptionByName(c);
                                        const season = getCountrySeasonByName(getDestinationSeasonCountryName(c));
                                        const fallback = COUNTRIES.find((x) => x.name === c);
                                        return (
                                            <div key={c} className="group relative">
                                                <CountryTag
                                                    countryName={c}
                                                    flag={dest?.flag || season?.flag || fallback?.flag || '🌍'}
                                                    metaLabel={getDestinationMetaLabel(c)}
                                                    removable
                                                    onRemove={() => removeCountry(c)}
                                                />
                                                {season && (
                                                    <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-[80] hidden w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                                                        <div className="text-xs font-semibold text-gray-900">Ideal travel time</div>
                                                        <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Combined best-months strip */}
                            {seasonCountryNames.length > 0 && (commonMonths.ideal.length > 0 || commonMonths.shoulder.length > 0) && (
                                <div className="mt-3">
                                    <MonthSeasonStrip idealMonths={commonMonths.ideal} shoulderMonths={commonMonths.shoulder} />
                                </div>
                            )}
                        </div>

                        {/* ---- Section 2: Dates ---- */}
                        <div
                            className="rounded-2xl border border-gray-100 bg-gray-50/60 backdrop-blur-sm p-4 animate-hero-stagger"
                            style={{ '--stagger': 2 } as React.CSSProperties}
                        >
                            <SectionHeader number={2} icon={<CalendarBlank size={15} weight="duotone" />} label="Dates" />
                            <DateRangePicker
                                startDate={startDate}
                                endDate={endDate}
                                onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
                            />

                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <Checkbox checked={isRoundTrip} onCheckedChange={(v) => setIsRoundTrip(!!v)} />
                                    <span>Round trip</span>
                                </label>

                                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 border border-accent-100 px-3 py-1 text-xs font-medium text-accent-700">
                                    {duration} days
                                </span>

                                {seasonQuality && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                                        <span className={`inline-block h-2 w-2 rounded-full ${SEASON_DOT[seasonQuality.quality]}`} />
                                        {seasonQuality.label}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ---- Section 3: Style & Vibes ---- */}
                        <div
                            className="rounded-2xl border border-gray-100 bg-gray-50/60 backdrop-blur-sm p-4 animate-hero-stagger"
                            style={{ '--stagger': 3 } as React.CSSProperties}
                        >
                            <SectionHeader number={3} icon={<Compass size={15} weight="duotone" />} label="Style & Vibes" />
                            <p className="text-xs text-gray-500 mb-3">Optional — helps tailor the itinerary to your preferences.</p>

                            <div className="mb-3">
                                <div className="text-xs font-medium text-gray-600 mb-2">Travel style</div>
                                <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
                                    {STYLE_CARDS.map((card) => {
                                        const active = selectedStyles.includes(card.id);
                                        return (
                                            <button
                                                key={card.id}
                                                type="button"
                                                onClick={() => toggleChip(selectedStyles, card.id, setSelectedStyles)}
                                                className={[
                                                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                                                    active
                                                        ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-accent-300',
                                                ].join(' ')}
                                            >
                                                <span>{card.emoji}</span>
                                                <span>{card.title}</span>
                                                {active && <Check size={12} className="text-accent-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-gray-600 mb-2">Vibes</div>
                                <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
                                    {VIBE_CARDS.map((card) => {
                                        const active = selectedVibes.includes(card.id);
                                        return (
                                            <button
                                                key={card.id}
                                                type="button"
                                                onClick={() => toggleChip(selectedVibes, card.id, setSelectedVibes)}
                                                className={[
                                                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                                                    active
                                                        ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                        : 'border-gray-200 bg-white text-gray-600 hover:border-accent-300',
                                                ].join(' ')}
                                            >
                                                <span>{card.emoji}</span>
                                                <span>{card.title}</span>
                                                {active && <Check size={12} className="text-accent-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ---- Section 4: Fine-tune (collapsible) ---- */}
                        <div
                            className="rounded-2xl border border-gray-100 bg-gray-50/60 backdrop-blur-sm p-4 animate-hero-stagger"
                            style={{ '--stagger': 4 } as React.CSSProperties}
                        >
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 w-full text-left"
                            >
                                <SectionHeader number={4} icon={<SlidersHorizontal size={15} weight="duotone" />} label="Fine-tune" />
                                <ChevronDown
                                    size={14}
                                    className={`ml-auto text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                />
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

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label htmlFor="create-trip-v1-budget" className="block text-xs font-medium text-gray-600 mb-1">Budget</label>
                                            <Select value={budget} onValueChange={setBudget}>
                                                <SelectTrigger id="create-trip-v1-budget" className="w-full rounded-xl border-gray-200 bg-white text-sm text-gray-900 focus:border-accent-400 focus:ring-accent-400">
                                                    <span>{budget}</span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['Budget', 'Medium', 'Premium', 'Luxury'].map((option) => (
                                                        <SelectItem key={`v1-budget-${option}`} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label htmlFor="create-trip-v1-pace" className="block text-xs font-medium text-gray-600 mb-1">Pace</label>
                                            <Select value={pace} onValueChange={setPace}>
                                                <SelectTrigger id="create-trip-v1-pace" className="w-full rounded-xl border-gray-200 bg-white text-sm text-gray-900 focus:border-accent-400 focus:ring-accent-400">
                                                    <span>{pace}</span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['Relaxed', 'Balanced', 'Intensive'].map((option) => (
                                                        <SelectItem key={`v1-pace-${option}`} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Stops</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={numCities}
                                                onChange={(e) => setNumCities(e.target.value ? parseInt(e.target.value, 10) : '')}
                                                placeholder="Auto"
                                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none"
                                            />
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

                        {/* ---- Section 5: Notes ---- */}
                        <div
                            className="rounded-2xl border border-gray-100 bg-gray-50/60 backdrop-blur-sm p-4 animate-hero-stagger"
                            style={{ '--stagger': 5 } as React.CSSProperties}
                        >
                            <SectionHeader number={5} icon={<AlignLeft size={15} weight="duotone" />} label="Notes" />
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Anything else? e.g. food preferences, must-see spots, travel companions..."
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none resize-none"
                            />
                        </div>

                        {/* ---- Error ---- */}
                        {generationError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                <AlertTriangle size={16} weight="duotone" className="shrink-0 mt-0.5" />
                                <span>{generationError}</span>
                            </div>
                        )}

                        {/* ---- Buttons ---- */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="submit"
                                disabled={selectedCountries.length === 0 || isGenerating}
                                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={16} weight="duotone" />
                                Generate Trip
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBlank}
                                disabled={selectedCountries.length === 0}
                                className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FilePlus size={16} weight="duotone" />
                                Create Blank
                            </button>
                        </div>

                        {/* ---- Quick examples ---- */}
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                onClick={() => fillExample('Italy', 14, 'Rome, Florence, Venice. Art & Food.')}
                            >
                                <FlagIcon code="IT" />
                                2 Weeks in Italy
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                onClick={() => fillExample('Japan', 7, 'Anime, Tech, and Sushi.')}
                            >
                                <FlagIcon code="JP" />
                                7 Days in Japan
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                onClick={() => onTripGenerated(createThailandTrip(new Date().toISOString()))}
                            >
                                <FlagIcon code="TH" />
                                Thailand (Test Plan)
                            </button>
                        </div>
                    </div>
                </form>

                <div className="h-8" />
            </div>

            <div className="relative z-10">
                <SiteFooter />
            </div>
        </div>
    );
};
