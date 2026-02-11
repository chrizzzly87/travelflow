import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Warning as AlertTriangle,
    Check,
    CaretLeft as ChevronLeft,
    CaretRight as ChevronRight,
    FilePlus,
    MapPin,
    SpinnerGap as Loader2,
    Sparkle as Sparkles,
    CalendarBlank,
    TextAlignLeft as AlignLeft,
    Globe,
    Compass,
    ArrowRight,
} from '@phosphor-icons/react';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { MonthSeasonStrip } from '../components/MonthSeasonStrip';
import { Checkbox } from '../components/ui/checkbox';
import { generateWizardItinerary } from '../services/geminiService';
import { ITimelineItem, ITrip } from '../types';
import {
    addDays,
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
import { HeroWebGLBackground } from '../components/HeroWebGLBackground';
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

interface CreateTripV3PageProps {
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
// Card data
// ---------------------------------------------------------------------------

interface SelectionCardConfig {
    id: string;
    title: string;
    description: string;
    emoji?: string;
}

const STYLE_CARDS: SelectionCardConfig[] = [
    { id: 'first-timer', title: 'First-Timer', description: 'Easy logistics, iconic highlights, minimal friction.', emoji: '🧭' },
    { id: 'backpacker', title: 'Backpacker', description: 'Budget-minded routing with flexible experiences.', emoji: '🎒' },
    { id: 'slow-travel', title: 'Slow Travel', description: 'Fewer moves, deeper local immersion, longer stays.', emoji: '🐢' },
    { id: 'comfort-explorer', title: 'Comfort Explorer', description: 'Balanced pace with convenient transitions.', emoji: '🛋️' },
];

const VIBE_CARDS: SelectionCardConfig[] = [
    { id: 'food', title: 'Food & Markets', description: 'Regional dishes and standout local spots.', emoji: '🍜' },
    { id: 'culture', title: 'Culture & History', description: 'Museums, heritage areas, and traditions.', emoji: '🏛️' },
    { id: 'nature', title: 'Nature & Scenic', description: 'Parks, viewpoints, and high-value nature stops.', emoji: '🏞️' },
    { id: 'adventure', title: 'Adventure', description: 'Hikes, active days, and challenge-heavy plans.', emoji: '🥾' },
    { id: 'relaxation', title: 'Relaxation', description: 'Slower pacing, wellness, and recharge time.', emoji: '🌴' },
    { id: 'nightlife', title: 'Nightlife', description: 'Bars, live music, and evening energy.', emoji: '🌃' },
];

// Popular picks for step 1
interface PopularPick {
    name: string;
    flag: string;
    bestMonths: string;
}

const POPULAR_PICKS: PopularPick[] = [
    { name: 'Japan', flag: '🇯🇵', bestMonths: 'Mar-May, Sep-Nov' },
    { name: 'Italy', flag: '🇮🇹', bestMonths: 'Apr-Jun, Sep-Oct' },
    { name: 'Thailand', flag: '🇹🇭', bestMonths: 'Nov-Feb' },
    { name: 'Portugal', flag: '🇵🇹', bestMonths: 'Apr-Oct' },
    { name: 'Greece', flag: '🇬🇷', bestMonths: 'May-Oct' },
    { name: 'New Zealand', flag: '🇳🇿', bestMonths: 'Dec-Mar' },
    { name: 'Morocco', flag: '🇲🇦', bestMonths: 'Mar-May, Sep-Nov' },
    { name: 'South Korea', flag: '🇰🇷', bestMonths: 'Apr-Jun, Sep-Nov' },
];

const BUDGET_OPTIONS = ['Budget', 'Medium', 'Premium', 'Luxury'] as const;
const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Intensive'] as const;

// ---------------------------------------------------------------------------
// Season quality
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

const SEASON_DOT: Record<SeasonQuality, string> = {
    great: 'bg-green-500',
    shoulder: 'bg-amber-500',
    off: 'bg-red-400',
};

// ---------------------------------------------------------------------------
// Step Dots
// ---------------------------------------------------------------------------

const StepDots: React.FC<{ currentStep: number; totalSteps: number; completedSteps: Set<number>; onStepClick: (step: number) => void }> = ({
    currentStep,
    totalSteps,
    completedSteps,
    onStepClick,
}) => (
    <div className="flex items-center justify-center gap-2 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => {
            const step = i + 1;
            const isActive = step === currentStep;
            const isCompleted = completedSteps.has(step);
            const isClickable = isCompleted || step < currentStep;

            return (
                <button
                    key={step}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick(step)}
                    className={[
                        'h-2.5 rounded-full transition-all',
                        isActive ? 'w-8 bg-accent-600' : isCompleted ? 'w-2.5 bg-accent-300 hover:bg-accent-400 cursor-pointer' : 'w-2.5 bg-gray-200',
                        !isClickable && !isActive ? 'cursor-default' : '',
                    ].join(' ')}
                    aria-label={`Step ${step}`}
                />
            );
        })}
    </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CreateTripV3Page: React.FC<CreateTripV3PageProps> = ({ onTripGenerated, onOpenManager }) => {
    const defaultDates = getDefaultTripDates();

    // ---- Step state ----
    const [currentStep, setCurrentStep] = useState(1);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionDirection, setTransitionDirection] = useState<'forward' | 'back'>('forward');
    const TOTAL_STEPS = 5;

    // ---- Form state ----
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [isRoundTrip, setIsRoundTrip] = useState(true);
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
    const [specificCities, setSpecificCities] = useState('');
    const [budget, setBudget] = useState('Medium');
    const [pace, setPace] = useState('Balanced');
    const [notes, setNotes] = useState('');
    const [enforceIslandOnly, setEnforceIslandOnly] = useState(true);

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

    // ---- Derived ----
    const destination = selectedCountries.join(', ');
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
    const seasonQuality = getSeasonQuality(seasonCountryNames, startDate, endDate);

    const completedSteps = useMemo(() => {
        const set = new Set<number>();
        if (selectedCountries.length > 0) set.add(1);
        if (startDate && endDate) set.add(2);
        if (selectedStyles.length > 0 || selectedVibes.length > 0) set.add(3);
        set.add(4); // always optional
        return set;
    }, [selectedCountries, startDate, endDate, selectedStyles, selectedVibes]);

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

    // ---- Step navigation ----
    const goToStep = (step: number, direction?: 'forward' | 'back') => {
        if (step < 1 || step > TOTAL_STEPS || step === currentStep) return;
        const dir = direction || (step > currentStep ? 'forward' : 'back');
        setTransitionDirection(dir);
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentStep(step);
            setIsTransitioning(false);
        }, 150);
    };

    const goNext = () => goToStep(currentStep + 1, 'forward');
    const goBack = () => goToStep(currentStep - 1, 'back');

    // ---- Country helpers ----
    const addCountry = useCallback((name: string) => {
        const resolved = resolveDestinationName(name);
        setSelectedCountries((prev) => (prev.includes(resolved) ? prev : [...prev, resolved]));
    }, []);

    const removeCountry = useCallback((name: string) => {
        setSelectedCountries((prev) => prev.filter((c) => c !== name));
    }, []);

    const togglePopularPick = (name: string) => {
        if (selectedCountries.includes(name)) {
            removeCountry(name);
        } else {
            addCountry(name);
        }
    };

    const toggleChip = (current: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
    };

    // ---- Generation ----
    const buildPreviewTrip = (params: { destination: string; startDate: string; endDate: string }): ITrip => {
        const now = Date.now();
        const totalDays = getDaysDifference(params.startDate, params.endDate);
        const cityCount = Math.max(1, Math.min(4, Math.max(2, Math.round(totalDays / 4))));
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

    const handleGenerate = async () => {
        const primary = selectedCountries[0] || destination;
        setPreviewTrip(buildPreviewTrip({ destination: primary, startDate, endDate }));
        setGenerationSummary({ destination: primary, startDate, endDate });
        setIsGenerating(true);
        setGenerationError(null);

        try {
            const trip = await generateWizardItinerary({
                countries: selectedCountries.map((c) => getDestinationPromptLabel(c)),
                startDate,
                endDate,
                roundTrip: isRoundTrip,
                totalDays: duration,
                notes: [notes, specificCities ? `Must visit: ${specificCities}` : ''].filter(Boolean).join('. '),
                travelStyles: selectedStyles,
                travelVibes: selectedVibes,
                travelLogistics: [],
                idealMonths: monthLabelsFromNumbers(commonMonths.ideal),
                shoulderMonths: monthLabelsFromNumbers(commonMonths.shoulder),
                recommendedDurationDays: durationRec.recommended,
                selectedIslandNames,
                enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
            });
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error) {
            console.error('V3 generation failed:', error);
            setPreviewTrip(null);
            if (error instanceof Error) {
                setGenerationError(error.message || 'Failed to generate itinerary.');
            } else {
                setGenerationError('Failed to generate itinerary.');
            }
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

    // ---- Step content ----
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Where do you dream of going?
                        </h2>
                        <p className="text-gray-500 text-sm text-center mb-6">Pick one or more destinations for your trip.</p>

                        <CountrySelect
                            selectedCountries={selectedCountries}
                            onAdd={addCountry}
                            onRemove={removeCountry}
                        />

                        {selectedCountries.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 justify-center">
                                {selectedCountries.map((c) => {
                                    const dest = getDestinationOptionByName(c);
                                    const season = getCountrySeasonByName(getDestinationSeasonCountryName(c));
                                    const fb = COUNTRIES.find((x) => x.name === c);
                                    return (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => removeCountry(c)}
                                            className="flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 transition-colors"
                                        >
                                            <span>{dest?.flag || season?.flag || fb?.flag || '🌍'}</span>
                                            <span>{c}</span>
                                            <span className="text-accent-400">×</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-6">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 text-center">Popular destinations</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                                {POPULAR_PICKS.map((pick) => {
                                    const isSelected = selectedCountries.includes(pick.name);
                                    return (
                                        <button
                                            key={pick.name}
                                            type="button"
                                            onClick={() => togglePopularPick(pick.name)}
                                            className={[
                                                'flex flex-col items-center rounded-2xl border p-3 transition-all text-center',
                                                isSelected
                                                    ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                                    : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40',
                                            ].join(' ')}
                                        >
                                            <span className="text-3xl mb-1">{pick.flag}</span>
                                            <span className="text-sm font-semibold text-gray-900">{pick.name}</span>
                                            <span className="text-[10px] text-gray-500 mt-0.5">{pick.bestMonths}</span>
                                            {isSelected && (
                                                <span className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-white">
                                                    <Check size={12} />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center">
                            <button
                                type="button"
                                onClick={goNext}
                                disabled={selectedCountries.length === 0}
                                className="flex items-center gap-2 rounded-2xl bg-accent-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Continue
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            When are you traveling?
                        </h2>
                        <p className="text-gray-500 text-sm text-center mb-6">Pick your travel dates.</p>

                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={setStartDate}
                            onEndDateChange={setEndDate}
                        />

                        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                            <span className="inline-flex items-center rounded-full bg-accent-50 border border-accent-100 px-3 py-1 text-xs font-medium text-accent-700">
                                {duration} days
                            </span>
                            {seasonQuality && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                                    <span className={`inline-block h-2 w-2 rounded-full ${SEASON_DOT[seasonQuality.quality]}`} />
                                    {seasonQuality.label}
                                </span>
                            )}
                        </div>

                        {seasonCountryNames.length > 0 && (commonMonths.ideal.length > 0 || commonMonths.shoulder.length > 0) && (
                            <div className="mt-4">
                                <MonthSeasonStrip idealMonths={commonMonths.ideal} shoulderMonths={commonMonths.shoulder} />
                            </div>
                        )}

                        <div className="mt-4 flex justify-center">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                <Checkbox checked={isRoundTrip} onCheckedChange={(v) => setIsRoundTrip(!!v)} />
                                <span>Round trip</span>
                            </label>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-3">
                            <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-accent-300 transition-colors">
                                <ChevronLeft size={14} /> Back
                            </button>
                            <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-2xl bg-accent-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors">
                                Continue <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            What's your travel style?
                        </h2>
                        <p className="text-gray-500 text-sm text-center mb-6">Optional — helps us personalize your itinerary.</p>

                        <div className="mb-5">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Style</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {STYLE_CARDS.map((card) => {
                                    const active = selectedStyles.includes(card.id);
                                    return (
                                        <button
                                            key={card.id}
                                            type="button"
                                            onClick={() => toggleChip(selectedStyles, card.id, setSelectedStyles)}
                                            className={[
                                                'text-left rounded-2xl border p-3.5 transition-all',
                                                active
                                                    ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                                    : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                                        <span className="text-base">{card.emoji}</span>
                                                        <span>{card.title}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-600 mt-0.5">{card.description}</div>
                                                </div>
                                                {active && (
                                                    <span className="h-5 w-5 rounded-full bg-accent-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                                        <Check size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mb-5">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Vibes</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {VIBE_CARDS.map((card) => {
                                    const active = selectedVibes.includes(card.id);
                                    return (
                                        <button
                                            key={card.id}
                                            type="button"
                                            onClick={() => toggleChip(selectedVibes, card.id, setSelectedVibes)}
                                            className={[
                                                'text-left rounded-2xl border p-3.5 transition-all',
                                                active
                                                    ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                                    : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                                    <span className="text-base">{card.emoji}</span>
                                                    <span>{card.title}</span>
                                                </div>
                                                {active && (
                                                    <span className="h-5 w-5 rounded-full bg-accent-500 text-white flex items-center justify-center shrink-0">
                                                        <Check size={12} />
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-accent-300 transition-colors">
                                <ChevronLeft size={14} /> Back
                            </button>
                            <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-2xl bg-accent-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors">
                                {selectedStyles.length === 0 && selectedVibes.length === 0 ? 'Skip' : 'Continue'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Anything else we should know?
                        </h2>
                        <p className="text-gray-500 text-sm text-center mb-6">Optional details to fine-tune your trip.</p>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Specific cities</label>
                                <input
                                    type="text"
                                    value={specificCities}
                                    onChange={(e) => setSpecificCities(e.target.value)}
                                    placeholder="e.g. Rome, Florence, Venice"
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-2">Budget</label>
                                <div className="grid grid-cols-2 sm:flex sm:flex-row rounded-xl border border-gray-200 overflow-hidden">
                                    {BUDGET_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setBudget(opt)}
                                            className={[
                                                'px-4 py-2.5 text-sm font-medium transition-colors border-r border-b sm:border-b-0 last:border-r-0',
                                                budget === opt
                                                    ? 'bg-accent-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-accent-50',
                                            ].join(' ')}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-2">Pace</label>
                                <div className="grid grid-cols-2 sm:flex sm:flex-row rounded-xl border border-gray-200 overflow-hidden">
                                    {PACE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setPace(opt)}
                                            className={[
                                                'px-4 py-2.5 text-sm font-medium transition-colors border-r border-b sm:border-b-0 last:border-r-0',
                                                pace === opt
                                                    ? 'bg-accent-600 text-white'
                                                    : 'bg-white text-gray-600 hover:bg-accent-50',
                                            ].join(' ')}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Food preferences, must-see spots, travel companions..."
                                    rows={3}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 outline-none resize-none"
                                />
                            </div>

                            {hasIslandSelection && (
                                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                    <Checkbox checked={enforceIslandOnly} onCheckedChange={(v) => setEnforceIslandOnly(!!v)} />
                                    <span>Island-only planning</span>
                                </label>
                            )}
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-3">
                            <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-accent-300 transition-colors">
                                <ChevronLeft size={14} /> Back
                            </button>
                            <button type="button" onClick={goNext} className="flex items-center gap-2 rounded-2xl bg-accent-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors">
                                {!specificCities && !notes ? 'Skip' : 'Continue'} <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                );

            case 5:
                return (
                    <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                            Your trip is ready
                        </h2>
                        <p className="text-gray-500 text-sm text-center mb-6">Review your selections and generate.</p>

                        {/* Summary card */}
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5 space-y-3 mb-6">
                            <div className="flex items-center gap-2 text-sm">
                                <Globe size={16} className="text-accent-500" />
                                <span className="font-semibold text-gray-900">Destinations:</span>
                                <span className="text-gray-700">{selectedCountries.join(', ') || 'None'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <CalendarBlank size={16} className="text-accent-500" />
                                <span className="font-semibold text-gray-900">Dates:</span>
                                <span className="text-gray-700">{formatDateRange(startDate, endDate)} ({duration} days)</span>
                            </div>
                            {seasonQuality && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${SEASON_DOT[seasonQuality.quality]}`} />
                                    <span className="text-gray-700">{seasonQuality.label}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <Compass size={16} className="text-accent-500" />
                                <span className="font-semibold text-gray-900">Route:</span>
                                <span className="text-gray-700">{isRoundTrip ? 'Round trip' : 'One way'}</span>
                            </div>
                            {selectedStyles.length > 0 && (
                                <div className="flex items-start gap-2 text-sm">
                                    <span className="font-semibold text-gray-900 shrink-0">Style:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedStyles.map((s) => {
                                            const card = STYLE_CARDS.find((c) => c.id === s);
                                            return card ? (
                                                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-accent-50 border border-accent-100 px-2 py-0.5 text-xs text-accent-700">
                                                    {card.emoji} {card.title}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                            {selectedVibes.length > 0 && (
                                <div className="flex items-start gap-2 text-sm">
                                    <span className="font-semibold text-gray-900 shrink-0">Vibes:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedVibes.map((v) => {
                                            const card = VIBE_CARDS.find((c) => c.id === v);
                                            return card ? (
                                                <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent-50 border border-accent-100 px-2 py-0.5 text-xs text-accent-700">
                                                    {card.emoji} {card.title}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                            {budget !== 'Medium' && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-gray-900">Budget:</span>
                                    <span className="text-gray-700">{budget}</span>
                                </div>
                            )}
                            {pace !== 'Balanced' && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-gray-900">Pace:</span>
                                    <span className="text-gray-700">{pace}</span>
                                </div>
                            )}
                            {notes && (
                                <div className="flex items-start gap-2 text-sm">
                                    <AlignLeft size={16} className="text-accent-500 shrink-0 mt-0.5" />
                                    <span className="text-gray-700">{notes}</span>
                                </div>
                            )}
                        </div>

                        {/* Error */}
                        {generationError && (
                            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>{generationError}</span>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button type="button" onClick={goBack} className="flex items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-accent-300 transition-colors">
                                <ChevronLeft size={14} /> Back
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={selectedCountries.length === 0 || isGenerating}
                                className="flex items-center gap-2 rounded-2xl bg-accent-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/50 hover:bg-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles size={16} weight="fill" />
                                Generate Trip
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBlank}
                                disabled={selectedCountries.length === 0}
                                className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-accent-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FilePlus size={16} />
                                Create Blank
                            </button>
                        </div>

                        {/* Quick examples */}
                        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
                            <button type="button" className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm" onClick={() => onTripGenerated(createThailandTrip(new Date().toISOString()))}>
                                🇹🇭 Thailand (Test Plan)
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    // ---- Main render ----
    const progressPercent = (currentStep / TOTAL_STEPS) * 100;

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
                {/* Step dots */}
                <StepDots
                    currentStep={currentStep}
                    totalSteps={TOTAL_STEPS}
                    completedSteps={completedSteps}
                    onStepClick={(step) => goToStep(step)}
                />

                {/* Step card */}
                <div
                    className={[
                        'bg-white/90 backdrop-blur-md p-5 sm:p-7 rounded-3xl shadow-2xl ring-1 ring-slate-900/5 border border-gray-100 w-full max-w-xl mx-4 relative transition-all duration-150',
                        isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100 animate-content-fade-in',
                    ].join(' ')}
                >
                    {renderStepContent()}
                </div>

                <div className="h-20" />
            </div>

            {/* Progress bar - fixed bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-50 h-1 bg-gray-100">
                <div
                    className="h-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            <div className="relative z-10">
                <SiteFooter />
            </div>
        </div>
    );
};
