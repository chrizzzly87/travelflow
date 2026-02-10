import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    Warning as AlertTriangle,
    TextAlignLeft as AlignLeft,
    Check,
    CaretDown as ChevronDown,
    CaretLeft as ChevronLeft,
    CaretRight as ChevronRight,
    Clock,
    Compass,
    DiceSix as Dice6,
    FilePlus,
    Info,
    SpinnerGap as Loader2,
    MapPin,
    Plus,
    MagnifyingGlass as Search,
    GearSix as Settings,
    Sparkle as Sparkles,
    MagicWand as Wand2,
    X,
} from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { CountrySelect } from './CountrySelect';
import { DateRangePicker } from './DateRangePicker';
import { CountryTag } from './CountryTag';
import { IdealTravelTimeline } from './IdealTravelTimeline';
import { MonthSeasonStrip } from './MonthSeasonStrip';
import { Checkbox } from './ui/checkbox';
import { generateItinerary, generateSurpriseItinerary, generateWizardItinerary } from '../services/geminiService';
import { ITimelineItem, ITrip, TripPrefillData } from '../types';
import {
    addDays,
    COUNTRIES,
    decodeTripPrefill,
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationPromptLabel,
    getDestinationSeasonCountryName,
    generateTripId,
    getDefaultTripDates,
    getDaysDifference,
    isIslandDestination,
    resolveDestinationName,
    searchDestinationOptions,
} from '../utils';
import { createThailandTrip } from '../data/exampleTrips';
import { TripView } from './TripView';
import { TripGenerationSkeleton } from './TripGenerationSkeleton';
import { HeroWebGLBackground } from './HeroWebGLBackground';
import { SiteFooter } from './marketing/SiteFooter';
import { SiteHeader } from './navigation/SiteHeader';
import {
    CountrySeasonEntry,
    getCommonBestMonths,
    getCountrySeasonByName,
    getDurationRecommendation,
    monthRangeBetweenDates,
    MONTH_LABELS,
    rankCountriesForMonths,
} from '../data/countryTravelData';

interface CreateTripFormProps {
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

type FormMode = 'classic' | 'wizard' | 'surprise';
type SurpriseInputMode = 'month-duration' | 'date-range';
type WizardStep = 1 | 2 | 3 | 4;

interface SelectionCardConfig {
    id: string;
    title: string;
    description: string;
    emoji?: string;
}

const GENERATION_MESSAGES = [
    'Analyzing your travel preferences...',
    'Scouting top-rated cities and stops...',
    'Calculating optimal travel routes...',
    'Structuring your daily timeline...',
    'Finalizing logistics and details...'
];

const TAB_ITEMS: Array<{ id: FormMode; title: string; subtitle: string; beta?: boolean; icon: React.ReactNode }> = [
    {
        id: 'classic',
        title: 'Classic',
        subtitle: 'Stable and fully supported',
        icon: <Sparkles size={16} weight="duotone" />,
    },
    {
        id: 'wizard',
        title: 'Wizard',
        subtitle: 'Guided multistep flow',
        beta: true,
        icon: <Wand2 size={16} weight="duotone" />,
    },
    {
        id: 'surprise',
        title: 'Surprise Me',
        subtitle: 'Timeframe-first discovery',
        beta: true,
        icon: <Dice6 size={16} weight="duotone" />,
    },
];

const WIZARD_STYLE_CARDS: SelectionCardConfig[] = [
    {
        id: 'first-timer',
        title: 'First-Timer',
        description: 'Easy logistics, iconic highlights, minimal friction.',
        emoji: '🧭',
    },
    {
        id: 'backpacker',
        title: 'Backpacker',
        description: 'Budget-minded routing with flexible experiences.',
        emoji: '🎒',
    },
    {
        id: 'slow-travel',
        title: 'Slow Travel',
        description: 'Fewer moves, deeper local immersion, longer stays.',
        emoji: '🐢',
    },
    {
        id: 'comfort-explorer',
        title: 'Comfort Explorer',
        description: 'Balanced pace with convenient transitions.',
        emoji: '🛋️',
    },
];

const WIZARD_VIBE_CARDS: SelectionCardConfig[] = [
    {
        id: 'food',
        title: 'Food & Markets',
        description: 'Regional dishes and standout local spots.',
        emoji: '🍜',
    },
    {
        id: 'culture',
        title: 'Culture & History',
        description: 'Museums, heritage areas, and traditions.',
        emoji: '🏛️',
    },
    {
        id: 'nature',
        title: 'Nature & Scenic',
        description: 'Parks, viewpoints, and high-value nature stops.',
        emoji: '🏞️',
    },
    {
        id: 'adventure',
        title: 'Adventure',
        description: 'Hikes, active days, and challenge-heavy plans.',
        emoji: '🥾',
    },
    {
        id: 'relaxation',
        title: 'Relaxation',
        description: 'Slower pacing, wellness, and recharge time.',
        emoji: '🌴',
    },
    {
        id: 'nightlife',
        title: 'Nightlife',
        description: 'Bars, live music, and evening energy.',
        emoji: '🌃',
    },
];

const WIZARD_LOGISTIC_CARDS: SelectionCardConfig[] = [
    {
        id: 'family',
        title: 'Family Friendly',
        description: 'Kid-friendly pacing and practical transitions.',
        emoji: '👨‍👩‍👧‍👦',
    },
    {
        id: 'digital-nomad',
        title: 'Digital Nomad',
        description: 'Longer stays and setup-friendly locations.',
        emoji: '💻',
    },
    {
        id: 'public-transport',
        title: 'Public Transport',
        description: 'Transit-first routing with realistic transfers.',
        emoji: '🚆',
    },
    {
        id: 'roadtrip',
        title: 'Roadtrip',
        description: 'Car-oriented paths and scenic drive potential.',
        emoji: '🚗',
    },
];

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

const parseCountries = (value: string): string[] => {
    const seen = new Set<string>();
    const list = value
        .split(',')
        .map((token) => resolveDestinationName(token))
        .filter(Boolean)
        .filter((country) => {
            const key = country.toLocaleLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    return list;
};

const buildMonthDurationRange = (month: number, weeks: number): { startDate: string; endDate: string } => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const year = month >= currentMonth ? now.getFullYear() : now.getFullYear() + 1;
    const start = new Date(year, month - 1, 1);
    const end = addDays(start, Math.max(1, weeks * 7) - 1);
    return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
    };
};

const SelectionCard: React.FC<{
    card: SelectionCardConfig;
    selected: boolean;
    onToggle: (id: string) => void;
}> = ({ card, selected, onToggle }) => {
    return (
        <button
            type="button"
            onClick={() => onToggle(card.id)}
            className={[
                'text-left rounded-2xl border p-3.5 transition-all shadow-sm',
                selected
                    ? 'border-accent-500 bg-accent-50 shadow-accent-100'
                    : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40',
            ].join(' ')}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        {card.emoji && <span className="text-base" aria-hidden="true">{card.emoji}</span>}
                        <span>{card.title}</span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{card.description}</div>
                </div>
                <span
                    className={[
                        'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                        selected ? 'border-accent-500 bg-accent-500 text-white' : 'border-gray-300 text-transparent',
                    ].join(' ')}
                >
                    <Check size={12} />
                </span>
            </div>
        </button>
    );
};

const SeasonAwareCountryTag: React.FC<{
    countryName: string;
    onRemove: () => void;
}> = ({ countryName, onRemove }) => {
    const destination = getDestinationOptionByName(countryName);
    const season = getCountrySeasonByName(getDestinationSeasonCountryName(countryName));
    const fallback = COUNTRIES.find((country) => country.name === countryName);
    const metaLabel = getDestinationMetaLabel(countryName);

    return (
        <div className="group relative">
            <CountryTag
                countryName={countryName}
                flag={destination?.flag || season?.flag || fallback?.flag || '🌍'}
                metaLabel={metaLabel}
                removable
                onRemove={onRemove}
            />
            {season && (
                <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-[80] hidden w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                    <div className="text-xs font-semibold text-gray-900">Ideal travel time</div>
                    <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                </div>
            )}
        </div>
    );
};

export const CreateTripForm: React.FC<CreateTripFormProps> = ({ onTripGenerated, onOpenManager }) => {
    const defaultDates = getDefaultTripDates();
    const [searchParams] = useSearchParams();

    const [mode, setMode] = useState<FormMode>('classic');
    const [prefillMeta, setPrefillMeta] = useState<TripPrefillData['meta'] | null>(null);

    // Shared countries across all flows.
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

    // Shared generation state.
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [previewTrip, setPreviewTrip] = useState<ITrip | null>(null);
    const [loadingMessage, setLoadingMessage] = useState(GENERATION_MESSAGES[0]);
    const [generationSummary, setGenerationSummary] = useState<{ destination: string; startDate: string; endDate: string }>({
        destination: '',
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
    });

    // Classic state.
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

    // Wizard state.
    const [wizardStep, setWizardStep] = useState<WizardStep>(1);
    const [wizardCountrySearch, setWizardCountrySearch] = useState('');
    const [wizardSearchOpen, setWizardSearchOpen] = useState(false);
    const [wizardRoundTrip, setWizardRoundTrip] = useState(true);
    const [wizardStartDate, setWizardStartDate] = useState(defaultDates.startDate);
    const [wizardEndDate, setWizardEndDate] = useState(defaultDates.endDate);
    const [wizardStyles, setWizardStyles] = useState<string[]>([]);
    const [wizardVibes, setWizardVibes] = useState<string[]>([]);
    const [wizardLogistics, setWizardLogistics] = useState<string[]>([]);
    const [wizardNotes, setWizardNotes] = useState('');

    // Surprise state.
    const [surpriseInputMode, setSurpriseInputMode] = useState<SurpriseInputMode>('month-duration');
    const [surpriseMonth, setSurpriseMonth] = useState(new Date().getMonth() + 1);
    const [surpriseWeeks, setSurpriseWeeks] = useState(2);
    const [surpriseStartDate, setSurpriseStartDate] = useState(defaultDates.startDate);
    const [surpriseEndDate, setSurpriseEndDate] = useState(defaultDates.endDate);
    const [surpriseChoiceCode, setSurpriseChoiceCode] = useState('');

    const wizardSearchRef = useRef<HTMLDivElement>(null);
    const wizardSearchDropdownRef = useRef<HTMLDivElement>(null);
    const [wizardSearchPosition, setWizardSearchPosition] = useState<{ top: number; left: number; width: number } | null>(null);

    const destination = selectedCountries.join(', ');
    const destinationPrompt = selectedCountries.map((country) => getDestinationPromptLabel(country)).join(', ');
    const seasonCountryNames = useMemo(() => {
        const seen = new Set<string>();
        return selectedCountries
            .map((country) => getDestinationSeasonCountryName(country))
            .filter((country) => {
                const key = country.toLocaleLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }, [selectedCountries]);
    const selectedIslandNames = useMemo(
        () => selectedCountries.filter((country) => isIslandDestination(country)),
        [selectedCountries]
    );
    const hasIslandSelection = selectedIslandNames.length > 0;
    const duration = getDaysDifference(startDate, endDate);
    const wizardDuration = getDaysDifference(wizardStartDate, wizardEndDate);

    const wizardCountryMatches = useMemo(() => {
        return searchDestinationOptions(wizardCountrySearch, {
            excludeNames: selectedCountries,
            limit: 20,
        });
    }, [selectedCountries, wizardCountrySearch]);

    const wizardCommonMonths = useMemo(() => getCommonBestMonths(seasonCountryNames), [seasonCountryNames]);

    const wizardDurationRecommendation = useMemo(
        () => getDurationRecommendation(seasonCountryNames, [...wizardStyles, ...wizardLogistics]),
        [seasonCountryNames, wizardStyles, wizardLogistics]
    );

    const wizardStepChecks = {
        1: selectedCountries.length > 0,
        2: wizardStyles.length > 0 && wizardVibes.length > 0,
        3: Boolean(wizardStartDate && wizardEndDate),
    };

    const wizardCanGenerate = wizardStepChecks[1] && wizardStepChecks[2] && wizardStepChecks[3];

    const updateWizardSearchPosition = useCallback(() => {
        if (!wizardSearchRef.current) return;
        const rect = wizardSearchRef.current.getBoundingClientRect();
        const width = Math.max(220, Math.min(rect.width, window.innerWidth - 16));
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setWizardSearchPosition({
            top: rect.bottom + 8,
            left,
            width,
        });
    }, []);

    const openWizardSearch = useCallback(() => {
        updateWizardSearchPosition();
        setWizardSearchOpen(true);
    }, [updateWizardSearchPosition]);

    const surpriseRange = useMemo(() => {
        if (surpriseInputMode === 'date-range') {
            return {
                startDate: surpriseStartDate,
                endDate: surpriseEndDate,
            };
        }
        return buildMonthDurationRange(surpriseMonth, surpriseWeeks);
    }, [surpriseInputMode, surpriseStartDate, surpriseEndDate, surpriseMonth, surpriseWeeks]);

    const surpriseDuration = getDaysDifference(surpriseRange.startDate, surpriseRange.endDate);
    const surpriseMonths = useMemo(
        () => monthRangeBetweenDates(surpriseRange.startDate, surpriseRange.endDate),
        [surpriseRange.startDate, surpriseRange.endDate]
    );

    const surpriseRankedCountries = useMemo(() => rankCountriesForMonths(surpriseMonths), [surpriseMonths]);

    const surpriseIdealCountries = useMemo(() => {
        if (surpriseMonths.length === 0) return [];
        return surpriseRankedCountries
            .map((item) => item.entry)
            .filter((entry) => surpriseMonths.some((month) => entry.bestMonths.includes(month)));
    }, [surpriseMonths, surpriseRankedCountries]);

    const surpriseRecommendations = useMemo(() => {
        const source = surpriseIdealCountries.length > 0 ? surpriseIdealCountries : surpriseRankedCountries.map((item) => item.entry);
        return source.slice(0, 6);
    }, [surpriseIdealCountries, surpriseRankedCountries]);

    const selectedSurpriseOption = useMemo(
        () => surpriseRecommendations.find((entry) => entry.countryCode === surpriseChoiceCode) || surpriseRecommendations[0],
        [surpriseChoiceCode, surpriseRecommendations]
    );

    useEffect(() => {
        if (!surpriseRecommendations.length) {
            setSurpriseChoiceCode('');
            return;
        }
        setSurpriseChoiceCode((current) => {
            if (current && surpriseRecommendations.some((entry) => entry.countryCode === current)) return current;
            return surpriseRecommendations[0].countryCode;
        });
    }, [surpriseRecommendations]);

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

    // Apply URL prefill data on mount
    useEffect(() => {
        const raw = searchParams.get('prefill');
        if (!raw) return;
        const data = decodeTripPrefill(raw);
        if (!data) return;

        if (data.countries && data.countries.length > 0) {
            setSelectedCountries(data.countries);
        }
        if (data.startDate) { setStartDate(data.startDate); setWizardStartDate(data.startDate); }
        if (data.endDate) { setEndDate(data.endDate); setWizardEndDate(data.endDate); }
        if (data.budget) setBudget(data.budget);
        if (data.pace) setPace(data.pace);
        if (data.cities) setSpecificCities(data.cities);
        if (data.notes) { setNotes(data.notes); setWizardNotes(data.notes); }
        if (typeof data.roundTrip === 'boolean') { setIsRoundTrip(data.roundTrip); setWizardRoundTrip(data.roundTrip); }
        if (data.mode) setMode(data.mode);
        if (data.styles) setWizardStyles(data.styles);
        if (data.vibes) setWizardVibes(data.vibes);
        if (data.logistics) setWizardLogistics(data.logistics);
        if (data.meta) setPrefillMeta(data.meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
        if (!wizardSearchOpen) return;
        updateWizardSearchPosition();
    }, [wizardSearchOpen, wizardCountrySearch, selectedCountries.length, mode, wizardStep, updateWizardSearchPosition]);

    useEffect(() => {
        if (!wizardSearchOpen) return;
        const handlePositionChange = () => updateWizardSearchPosition();
        window.addEventListener('resize', handlePositionChange);
        window.addEventListener('scroll', handlePositionChange, true);
        return () => {
            window.removeEventListener('resize', handlePositionChange);
            window.removeEventListener('scroll', handlePositionChange, true);
        };
    }, [wizardSearchOpen, updateWizardSearchPosition]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            const inSearch = wizardSearchRef.current?.contains(target);
            const inDropdown = wizardSearchDropdownRef.current?.contains(target);
            if (!inSearch && !inDropdown) {
                setWizardSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const buildPreviewTrip = (params: {
        destination: string;
        startDate: string;
        endDate: string;
        requestedStops?: number;
    }): ITrip => {
        const now = Date.now();
        const totalDays = getDaysDifference(params.startDate, params.endDate);
        const requestedStops = typeof params.requestedStops === 'number'
            ? Math.max(1, Math.round(params.requestedStops))
            : Math.min(4, Math.max(2, Math.round(totalDays / 4)));
        const cityCount = Math.max(1, Math.min(requestedStops, totalDays));
        const baseDuration = Math.floor(totalDays / cityCount);
        const remainder = totalDays % cityCount;

        let offset = 0;
        const items: ITimelineItem[] = Array.from({ length: cityCount }).map((_, index) => {
            const cityDuration = baseDuration + (index < remainder ? 1 : 0);
            const item: ITimelineItem = {
                id: `loading-city-${index}-${now}`,
                type: 'city',
                title: `Loading stop ${index + 1}`,
                startDateOffset: offset,
                duration: cityDuration,
                color: 'bg-slate-100 border-slate-200 text-slate-400',
                description: 'AI is generating this part of your itinerary.',
                location: params.destination || 'Destination',
                loading: true,
            };
            offset += cityDuration;
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

    const setGenerationStart = (params: {
        destination: string;
        startDate: string;
        endDate: string;
        requestedStops?: number;
    }) => {
        setPreviewTrip(buildPreviewTrip(params));
        setGenerationSummary({
            destination: params.destination,
            startDate: params.startDate,
            endDate: params.endDate,
        });
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

    const setCountriesFromString = (value: string) => {
        setSelectedCountries(parseCountries(value));
    };

    const addSharedCountry = (countryName: string) => {
        const resolvedName = resolveDestinationName(countryName);
        setSelectedCountries((current) => {
            if (current.includes(resolvedName)) return current;
            return [...current, resolvedName];
        });
        setWizardCountrySearch('');
        setWizardSearchOpen(false);
    };

    const removeSharedCountry = (countryName: string) => {
        setSelectedCountries((current) => current.filter((country) => country !== countryName));
    };

    const toggleSelection = (current: string[], value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (current.includes(value)) {
            setter(current.filter((item) => item !== value));
            return;
        }
        setter([...current, value]);
    };

    const handleClassicGenerate = async (event: React.FormEvent) => {
        event.preventDefault();
        const primaryDestination = selectedCountries[0] || destination;

        setGenerationStart({
            destination: primaryDestination,
            startDate,
            endDate,
            requestedStops: typeof numCities === 'number' ? numCities : undefined,
        });

        try {
            const trip = await generateItinerary(destinationPrompt, startDate, {
                budget,
                pace,
                interests: notes.split(',').map((token) => token.trim()).filter(Boolean),
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
            console.error('Classic generation failed:', error);
            setGenerationFailure(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleWizardGenerate = async () => {
        if (!wizardCanGenerate) return;

        setGenerationStart({
            destination: selectedCountries[0] || destination,
            startDate: wizardStartDate,
            endDate: wizardEndDate,
        });

        try {
            const trip = await generateWizardItinerary({
                countries: selectedCountries.map((country) => getDestinationPromptLabel(country)),
                startDate: wizardStartDate,
                endDate: wizardEndDate,
                roundTrip: wizardRoundTrip,
                totalDays: wizardDuration,
                notes: wizardNotes,
                travelStyles: wizardStyles,
                travelVibes: wizardVibes,
                travelLogistics: wizardLogistics,
                idealMonths: monthLabelsFromNumbers(wizardCommonMonths.ideal),
                shoulderMonths: monthLabelsFromNumbers(wizardCommonMonths.shoulder),
                recommendedDurationDays: wizardDurationRecommendation.recommended,
                selectedIslandNames,
                enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
            });
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error) {
            console.error('Wizard generation failed:', error);
            setGenerationFailure(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSurpriseGenerate = async () => {
        if (!selectedSurpriseOption) {
            setGenerationError('No recommendations are available for this timeframe.');
            return;
        }

        setSelectedCountries([selectedSurpriseOption.countryName]);

        setGenerationStart({
            destination: selectedSurpriseOption.countryName,
            startDate: surpriseRange.startDate,
            endDate: surpriseRange.endDate,
        });

        try {
            const trip = await generateSurpriseItinerary({
                country: selectedSurpriseOption.countryName,
                startDate: surpriseRange.startDate,
                endDate: surpriseRange.endDate,
                totalDays: surpriseDuration,
                monthLabels: monthLabelsFromNumbers(surpriseMonths),
                durationWeeks: surpriseInputMode === 'month-duration' ? surpriseWeeks : undefined,
                seasonalEvents: selectedSurpriseOption.events.slice(0, 2).map((event) => `${event.name} (${event.monthLabel})`),
            });
            setPreviewTrip(null);
            onTripGenerated(trip);
        } catch (error) {
            console.error('Surprise generation failed:', error);
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
        setCountriesFromString(dest);
        const start = new Date();
        const end = addDays(start, days);
        setStartDate(toIsoDate(start));
        setEndDate(toIsoDate(end));
        setNotes(noteText);
        setMode('classic');
    };

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
                            {(generationSummary.destination || 'Destination')} • {formatDateRange(generationSummary.startDate, generationSummary.endDate)} • {getDaysDifference(generationSummary.startDate, generationSummary.endDate)} days
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

    const formWidthClass = mode === 'classic' ? 'max-w-lg' : 'max-w-2xl';

    return (
        <div className="w-full min-h-screen flex flex-col relative isolate overflow-hidden bg-slate-50">
            <HeroWebGLBackground className="z-0" />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-white/25" />
            <div className="pointer-events-none absolute -left-24 top-20 z-[1] h-72 w-72 rounded-full bg-accent-200/30 blur-[80px]" />
            <div className="pointer-events-none absolute -right-10 bottom-20 z-[1] h-80 w-80 rounded-full bg-accent-300/30 blur-[80px]" />

            <div className="relative z-20">
                <SiteHeader variant="glass" hideCreateTrip onMyTripsClick={onOpenManager} />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 pt-6 sm:pt-8 md:pt-10 overflow-y-auto w-full">
                <div className="text-center mb-6">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Plan your next adventure</h1>
                    <p className="text-gray-500">Choose a flow and generate your itinerary in seconds.</p>
                </div>

                <div className="w-full max-w-2xl mb-4">
                    <div className="rounded-2xl border border-accent-200 bg-white/80 px-4 py-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent-700">Design Labs</div>
                                <p className="text-sm text-gray-600">Test 3 new create-trip layouts without changing this page.</p>
                            </div>
                            <span className="rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-[11px] font-semibold text-accent-700">
                                Experimental
                            </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <Link
                                to="/create-trip/labs/classic-card"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-accent-300 hover:bg-accent-50/70"
                            >
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Concept 1</div>
                                <div className="text-sm font-semibold text-gray-800">Classic Card Overhaul</div>
                            </Link>
                            <Link
                                to="/create-trip/labs/split-workspace"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-accent-300 hover:bg-accent-50/70"
                            >
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Concept 2</div>
                                <div className="text-sm font-semibold text-gray-800">Split Workspace 50/50</div>
                            </Link>
                            <Link
                                to="/create-trip/labs/journey-architect"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-accent-300 hover:bg-accent-50/70"
                            >
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Concept 3</div>
                                <div className="text-sm font-semibold text-gray-800">Journey Architect</div>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className={`bg-white p-5 sm:p-6 rounded-3xl shadow-2xl ring-1 ring-slate-900/5 border border-gray-100 w-full ${formWidthClass} relative overflow-visible transition-all`}>
                    <div className="absolute top-0 left-0 w-full h-1.5 rounded-t-3xl bg-gradient-to-r from-accent-500 via-accent-600 to-accent-700 shadow-[0_1px_8px_rgb(var(--tf-accent-rgb)/0.3)]" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                        {TAB_ITEMS.map((tab) => {
                            const isActive = mode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setGenerationError(null);
                                        setMode(tab.id);
                                    }}
                                    className={[
                                        'rounded-2xl border px-4 py-3 text-left transition-all',
                                        isActive
                                            ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                            : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40'
                                    ].join(' ')}
                                >
                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                        <span className={isActive ? 'text-accent-600' : 'text-gray-400'}>{tab.icon}</span>
                                        <span>{tab.title}</span>
                                        {tab.beta && (
                                            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                BETA
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{tab.subtitle}</div>
                                </button>
                            );
                        })}
                    </div>

                    {(mode === 'wizard' || mode === 'surprise') && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
                            <Info size={13} className="mt-0.5 shrink-0" />
                            This beta flow is still in progress and will continue to be refined.
                        </div>
                    )}

                    {prefillMeta?.label && (
                        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-sm text-accent-800">
                            <span>Pre-filled from: <span className="font-semibold">{prefillMeta.label}</span></span>
                            <button type="button" onClick={() => setPrefillMeta(null)} className="text-accent-400 hover:text-accent-700" aria-label="Dismiss">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {generationError && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                            <div className="flex-1"><span className="font-bold block mb-1">Planning Failed</span>{generationError}</div>
                            <button onClick={() => setGenerationError(null)} className="text-red-400 hover:text-red-700" aria-label="Dismiss error">
                                <Check size={16} />
                            </button>
                        </div>
                    )}

                    {mode === 'classic' && (
                        <div>
                            <form className="space-y-4" onSubmit={handleClassicGenerate}>
                                <CountrySelect value={destination} onChange={setCountriesFromString} disabled={isGenerating} />

                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Route</label>
                                    <div className="flex items-center gap-2 px-1">
                                        <Checkbox
                                            id="roundtrip"
                                            checked={isRoundTrip}
                                            onCheckedChange={(checked) => setIsRoundTrip(checked === true)}
                                        />
                                        <label htmlFor="roundtrip" className="text-sm font-medium text-gray-600 cursor-pointer select-none">
                                            Roundtrip (end where you start)
                                        </label>
                                    </div>
                                </div>

                                <DateRangePicker
                                    startDate={startDate}
                                    endDate={endDate}
                                    onChange={(newStartDate, newEndDate) => {
                                        setStartDate(newStartDate);
                                        setEndDate(newEndDate);
                                    }}
                                    disabled={isGenerating}
                                />

                                <div className="flex justify-end items-center px-1">
                                    <div className="text-xs text-gray-400 font-medium">{duration} Days Total</div>
                                </div>

                                <div className="border-t border-gray-100 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvanced(!showAdvanced)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider hover:text-accent-600 transition-colors"
                                    >
                                        <Settings size={14} />
                                        Advanced Options
                                        <ChevronDown size={14} className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} />
                                    </button>

                                    {showAdvanced && (
                                        <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in slide-in-from-top-2">
                                            {hasIslandSelection && (
                                                <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                                    <div className="flex items-start gap-2">
                                                        <Checkbox
                                                            id="island-only"
                                                            className="mt-0.5"
                                                            checked={enforceIslandOnly}
                                                            onCheckedChange={(checked) => setEnforceIslandOnly(checked === true)}
                                                        />
                                                        <div>
                                                            <label htmlFor="island-only" className="text-sm font-medium text-amber-900 cursor-pointer select-none">
                                                                Keep itinerary on selected island(s)
                                                            </label>
                                                            <p className="text-xs text-amber-700 mt-0.5">
                                                                Default is on. Turn this off to allow mainland or nearby non-island stops.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="col-span-2 space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Specific Cities (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={specificCities}
                                                    onChange={(event) => setSpecificCities(event.target.value)}
                                                    placeholder="Paris, Lyon, Nice..."
                                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Budget</label>
                                                <select
                                                    value={budget}
                                                    onChange={(event) => setBudget(event.target.value)}
                                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                                >
                                                    <option>Low</option>
                                                    <option>Medium</option>
                                                    <option>High</option>
                                                    <option>Luxury</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Pace</label>
                                                <select
                                                    value={pace}
                                                    onChange={(event) => setPace(event.target.value)}
                                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                                >
                                                    <option>Relaxed</option>
                                                    <option>Balanced</option>
                                                    <option>Fast</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Stops</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={numCities}
                                                    onChange={(event) => setNumCities(event.target.value ? Number(event.target.value) : '')}
                                                    placeholder="Auto"
                                                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlignLeft size={14} className="text-accent-500" />
                                        Style & Preferences
                                    </label>
                                    <textarea
                                        value={notes}
                                        onChange={(event) => setNotes(event.target.value)}
                                        placeholder="e.g. Foodie tour, hiking focus, kid friendly..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-500 focus:bg-white transition-all outline-none h-20 resize-none text-gray-800 placeholder-gray-400 text-sm"
                                        disabled={isGenerating}
                                    />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="submit"
                                        disabled={isGenerating || selectedCountries.length === 0}
                                        className="flex-1 py-3 bg-gradient-to-r from-accent-600 to-accent-700 hover:from-accent-700 hover:to-accent-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:shadow-accent-glow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? <Loader2 className="animate-spin" size={20} weight="bold" /> : <Sparkles size={20} weight="duotone" />}
                                        <span>Auto-Generate</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCreateBlank}
                                        disabled={isGenerating}
                                        className="w-14 bg-white border border-gray-200 hover:border-gray-300 text-gray-500 hover:text-accent-600 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center disabled:opacity-50"
                                        title="Start Blank Itinerary"
                                    >
                                        <FilePlus size={22} />
                                    </button>
                                </div>
                            </form>

                            <div className="mt-5 flex flex-wrap gap-2 text-xs text-gray-500">
                                <button
                                    type="button"
                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                    onClick={() => fillExample('Italy', 14, 'Rome, Florence, Venice. Art & Food.')}
                                >
                                    🇮🇹 2 Weeks in Italy
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                    onClick={() => fillExample('Japan', 7, 'Anime, Tech, and Sushi.')}
                                >
                                    🇯🇵 7 Days in Japan
                                </button>
                                <button
                                    type="button"
                                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-accent-300 hover:text-accent-600 transition-all shadow-sm"
                                    onClick={() => onTripGenerated(createThailandTrip(new Date().toISOString()))}
                                >
                                    🇹🇭 Thailand (Test Plan)
                                </button>
                            </div>
                        </div>
                    )}

                    {mode === 'wizard' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map((rawStep) => {
                                    const step = rawStep as WizardStep;
                                    const isActive = wizardStep === step;
                                    const isCompleted =
                                        (step === 1 && wizardStepChecks[1]) ||
                                        (step === 2 && wizardStepChecks[2]) ||
                                        (step === 3 && wizardStepChecks[3]);

                                    return (
                                        <button
                                            key={step}
                                            type="button"
                                            className={[
                                                'rounded-xl border px-3 py-2 text-left transition-all',
                                                isActive ? 'border-accent-500 bg-accent-50' : 'border-gray-200 bg-white hover:border-accent-300',
                                            ].join(' ')}
                                            onClick={() => setWizardStep(step)}
                                        >
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Step {step}</div>
                                            <div className="text-xs font-medium text-gray-900 mt-0.5">
                                                {step === 1 && 'Countries'}
                                                {step === 2 && 'Preferences'}
                                                {step === 3 && 'Dates'}
                                                {step === 4 && 'Review'}
                                            </div>
                                            {isCompleted && <div className="text-[11px] text-emerald-600 mt-1">Complete</div>}
                                        </button>
                                    );
                                })}
                            </div>

                            {wizardStep === 1 && (
                                <section className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                            <Compass size={16} className="text-accent-600" />
                                            Select destination countries or islands
                                        </div>
                                        <p className="text-xs text-gray-500">These countries are shared automatically with Classic and Surprise Me.</p>
                                    </div>

                                    <div className="relative" ref={wizardSearchRef}>
                                        <div
                                            className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 min-h-[64px] flex flex-wrap items-start gap-2 focus-within:ring-2 focus-within:ring-accent-500 focus-within:bg-white"
                                            onClick={openWizardSearch}
                                        >
                                            {selectedCountries.map((countryName) => (
                                                <SeasonAwareCountryTag
                                                    key={countryName}
                                                    countryName={countryName}
                                                    onRemove={() => removeSharedCountry(countryName)}
                                                />
                                            ))}

                                            <div className="flex-1 min-w-[200px] flex items-center gap-2 h-8">
                                                {selectedCountries.length === 0 && <Search size={16} className="text-gray-400" />}
                                                <input
                                                    type="text"
                                                    value={wizardCountrySearch}
                                                    onChange={(event) => {
                                                        setWizardCountrySearch(event.target.value);
                                                        openWizardSearch();
                                                    }}
                                                    onFocus={openWizardSearch}
                                                    placeholder={selectedCountries.length === 0 ? 'Type countries or islands...' : 'Add another destination...'}
                                                    className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
                                                />
                                            </div>
                                        </div>

                                        {wizardSearchOpen && wizardSearchPosition && (wizardCountrySearch.trim() || wizardCountryMatches.length > 0) && typeof document !== 'undefined' && createPortal(
                                            <div
                                                ref={wizardSearchDropdownRef}
                                                className="fixed z-[9999] rounded-2xl border border-gray-200 bg-white shadow-xl max-h-64 overflow-y-auto"
                                                style={{
                                                    top: wizardSearchPosition.top,
                                                    left: wizardSearchPosition.left,
                                                    width: wizardSearchPosition.width,
                                                }}
                                            >
                                                {wizardCountryMatches.length > 0 ? (
                                                    wizardCountryMatches.map((country) => (
                                                        <button
                                                            key={country.code}
                                                            type="button"
                                                            onClick={() => addSharedCountry(country.name)}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3"
                                                        >
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                                                                    <span>{country.flag}</span>
                                                                    <span>{country.name}</span>
                                                                </div>
                                                                {country.kind === 'island' && country.parentCountryName && (
                                                                    <div className="text-xs text-gray-500 mt-0.5">Island of {country.parentCountryName}</div>
                                                                )}
                                                            </div>
                                                            <Plus size={14} className="text-accent-500" />
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-6 text-center text-sm text-gray-400">No matching countries</div>
                                                )}
                                            </div>,
                                            document.body
                                        )}
                                    </div>

                                    <div className="space-y-1.5 text-left">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Route</label>
                                        <div className="flex items-center gap-2 px-1">
                                            <Checkbox
                                                id="wizard-roundtrip"
                                                checked={wizardRoundTrip}
                                                onCheckedChange={(checked) => setWizardRoundTrip(checked === true)}
                                            />
                                            <label htmlFor="wizard-roundtrip" className="text-sm font-medium text-gray-600 cursor-pointer select-none">
                                                Roundtrip (return to starting city)
                                            </label>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {wizardStep === 2 && (
                                <section className="space-y-4">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">Traveler profile</div>
                                        <div className="text-xs text-gray-500">Pick at least one style and one vibe.</div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Travel style</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {WIZARD_STYLE_CARDS.map((card) => (
                                                <SelectionCard
                                                    key={card.id}
                                                    card={card}
                                                    selected={wizardStyles.includes(card.id)}
                                                    onToggle={(id) => toggleSelection(wizardStyles, id, setWizardStyles)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Trip vibe</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {WIZARD_VIBE_CARDS.map((card) => (
                                                <SelectionCard
                                                    key={card.id}
                                                    card={card}
                                                    selected={wizardVibes.includes(card.id)}
                                                    onToggle={(id) => toggleSelection(wizardVibes, id, setWizardVibes)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Logistics preferences (optional)</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {WIZARD_LOGISTIC_CARDS.map((card) => (
                                                <SelectionCard
                                                    key={card.id}
                                                    card={card}
                                                    selected={wizardLogistics.includes(card.id)}
                                                    onToggle={(id) => toggleSelection(wizardLogistics, id, setWizardLogistics)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {wizardStep === 3 && (
                                <section className="space-y-4">
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                        <div className="text-sm font-semibold text-emerald-900">Recommended duration</div>
                                        <div className="text-xs text-emerald-700 mt-1">
                                            Suggested: {wizardDurationRecommendation.recommended} days
                                            {' • '}Range: {wizardDurationRecommendation.min}-{wizardDurationRecommendation.max} days
                                        </div>
                                    </div>

                                    <DateRangePicker
                                        startDate={wizardStartDate}
                                        endDate={wizardEndDate}
                                        onChange={(newStartDate, newEndDate) => {
                                            setWizardStartDate(newStartDate);
                                            setWizardEndDate(newEndDate);
                                        }}
                                    />

                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-xs font-semibold text-gray-700">Selected months</div>
                                        <div className="mt-2">
                                            <MonthSeasonStrip idealMonths={monthRangeBetweenDates(wizardStartDate, wizardEndDate)} highlightedMonths={monthRangeBetweenDates(wizardStartDate, wizardEndDate)} compact />
                                        </div>
                                    </div>
                                </section>
                            )}

                            {wizardStep === 4 && (
                                <section className="space-y-4">
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                                        <div className="text-sm font-semibold text-gray-900">Review wizard inputs</div>
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Countries:</span> {selectedCountries.join(', ') || 'None'}</div>
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Style:</span> {wizardStyles.join(', ') || 'None'}</div>
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Vibes:</span> {wizardVibes.join(', ') || 'None'}</div>
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Dates:</span> {formatDateRange(wizardStartDate, wizardEndDate)} ({wizardDuration} days)</div>
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Roundtrip:</span> {wizardRoundTrip ? 'Yes' : 'No'}</div>
                                        {hasIslandSelection && (
                                            <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Island-only mode:</span> {enforceIslandOnly ? 'On' : 'Off'}</div>
                                        )}
                                        <div className="text-xs text-gray-600"><span className="font-semibold text-gray-800">Duration recommendation:</span> {wizardDurationRecommendation.recommended} days</div>

                                        {hasIslandSelection && (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                                <div className="flex items-start gap-2">
                                                    <Checkbox
                                                        id="wizard-island-only"
                                                        className="mt-0.5"
                                                        checked={enforceIslandOnly}
                                                        onCheckedChange={(checked) => setEnforceIslandOnly(checked === true)}
                                                    />
                                                    <div>
                                                        <label htmlFor="wizard-island-only" className="text-xs font-semibold text-amber-900 cursor-pointer select-none">
                                                            Keep route on selected island(s)
                                                        </label>
                                                        <p className="text-[11px] text-amber-700 mt-0.5">
                                                            Turn this off only when mainland or extra islands are intentionally needed.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5 text-left pt-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                                <AlignLeft size={14} className="text-accent-500" />
                                                Extra Notes for AI (optional)
                                            </label>
                                            <textarea
                                                value={wizardNotes}
                                                onChange={(event) => setWizardNotes(event.target.value)}
                                                placeholder="Anything else we should optimize for?"
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent-500 outline-none h-20 resize-none text-gray-800 placeholder-gray-400 text-sm"
                                            />
                                        </div>
                                    </div>
                                </section>
                            )}

                            <div className="flex items-center justify-between gap-3 pt-1">
                                <button
                                    type="button"
                                    disabled={wizardStep === 1}
                                    onClick={() => setWizardStep((current) => Math.max(1, current - 1) as WizardStep)}
                                    className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-accent-300 hover:text-accent-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                >
                                    <ChevronLeft size={14} />
                                    Back
                                </button>

                                {wizardStep < 4 ? (
                                    <button
                                        type="button"
                                        disabled={
                                            (wizardStep === 1 && !wizardStepChecks[1]) ||
                                            (wizardStep === 2 && !wizardStepChecks[2]) ||
                                            (wizardStep === 3 && !wizardStepChecks[3])
                                        }
                                        onClick={() => setWizardStep((current) => Math.min(4, current + 1) as WizardStep)}
                                        className="px-4 py-2 rounded-xl bg-accent-600 text-white text-sm font-semibold hover:bg-accent-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    >
                                        Next
                                        <ChevronRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleWizardGenerate}
                                        disabled={!wizardCanGenerate || isGenerating}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-600 to-accent-700 text-white text-sm font-semibold hover:from-accent-700 hover:to-accent-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    >
                                        {isGenerating ? <Loader2 size={14} className="animate-spin" weight="bold" /> : <Sparkles size={14} weight="duotone" />}
                                        Create Trip from Wizard
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {mode === 'surprise' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSurpriseInputMode('month-duration')}
                                    className={[
                                        'rounded-xl border px-3 py-2 text-left transition-all',
                                        surpriseInputMode === 'month-duration'
                                            ? 'border-accent-500 bg-accent-50'
                                            : 'border-gray-200 bg-white hover:border-accent-300',
                                    ].join(' ')}
                                >
                                    <div className="text-sm font-semibold text-gray-900">Month + Weeks</div>
                                    <div className="text-xs text-gray-500">Default and quickest option</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSurpriseInputMode('date-range')}
                                    className={[
                                        'rounded-xl border px-3 py-2 text-left transition-all',
                                        surpriseInputMode === 'date-range'
                                            ? 'border-accent-500 bg-accent-50'
                                            : 'border-gray-200 bg-white hover:border-accent-300',
                                    ].join(' ')}
                                >
                                    <div className="text-sm font-semibold text-gray-900">Start + End Dates</div>
                                    <div className="text-xs text-gray-500">Use exact date range</div>
                                </button>
                            </div>

                            {surpriseInputMode === 'month-duration' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Month</label>
                                        <select
                                            value={surpriseMonth}
                                            onChange={(event) => setSurpriseMonth(Number(event.target.value))}
                                            className="mt-1 w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                        >
                                            {MONTH_LABELS.map((label, index) => (
                                                <option key={label} value={index + 1}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Duration (weeks)</label>
                                        <select
                                            value={surpriseWeeks}
                                            onChange={(event) => setSurpriseWeeks(Number(event.target.value))}
                                            className="mt-1 w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-accent-500 outline-none"
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => (
                                                <option key={week} value={week}>{week} week{week > 1 ? 's' : ''}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <DateRangePicker
                                    startDate={surpriseStartDate}
                                    endDate={surpriseEndDate}
                                    onChange={(newStartDate, newEndDate) => {
                                        setSurpriseStartDate(newStartDate);
                                        setSurpriseEndDate(newEndDate);
                                    }}
                                />
                            )}

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <div className="text-xs font-semibold text-gray-700">Travel window</div>
                                <div className="text-xs text-gray-600 mt-1">{formatDateRange(surpriseRange.startDate, surpriseRange.endDate)} ({surpriseDuration} days)</div>
                                <div className="mt-2">
                                    <MonthSeasonStrip idealMonths={surpriseMonths} highlightedMonths={surpriseMonths} compact />
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Recommendations</div>
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {surpriseIdealCountries.slice(0, 10).map((entry) => (
                                        <CountryTag key={entry.countryCode} countryName={entry.countryName} flag={entry.flag} size="sm" />
                                    ))}
                                </div>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {surpriseRecommendations.map((entry) => {
                                        const ranked = surpriseRankedCountries.find((item) => item.entry.countryCode === entry.countryCode);
                                        const selected = selectedSurpriseOption?.countryCode === entry.countryCode;

                                        return (
                                            <button
                                                key={entry.countryCode}
                                                type="button"
                                                onClick={() => {
                                                    setSurpriseChoiceCode(entry.countryCode);
                                                    setSelectedCountries([entry.countryName]);
                                                }}
                                                className={[
                                                    'w-full rounded-xl border px-3 py-2 text-left transition-all',
                                                    selected
                                                        ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                                        : 'border-gray-200 bg-white hover:border-accent-300 hover:bg-accent-50/40',
                                                ].join(' ')}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                                        <span>{entry.flag}</span>
                                                        <span>{entry.countryName}</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">Score {ranked?.score || 0}</div>
                                                </div>
                                                <div className="text-xs text-gray-600 mt-1">Best months: {entry.bestMonthsLabel}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedSurpriseOption && (
                                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-1.5">
                                    <div className="text-sm font-semibold text-gray-900">{selectedSurpriseOption.flag} {selectedSurpriseOption.countryName}</div>
                                    <div className="text-xs text-gray-600">Suggested trip length: {selectedSurpriseOption.suggestedTripDays.recommended} days</div>
                                    <div className="text-xs text-gray-600">
                                        Seasonal highlights: {selectedSurpriseOption.events.slice(0, 2).map((event) => `${event.name} (${event.monthLabel})`).join(' • ')}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={handleSurpriseGenerate}
                                    disabled={!selectedSurpriseOption || isGenerating}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent-600 to-accent-700 text-white text-sm font-semibold hover:from-accent-700 hover:to-accent-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                >
                                    {isGenerating ? <Loader2 size={15} className="animate-spin" weight="bold" /> : <Sparkles size={15} weight="duotone" />}
                                    Generate Surprise Trip
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative z-[2] mt-auto">
                <SiteFooter className="bg-white/75 backdrop-blur border-slate-200/70" />
            </div>

        </div>
    );
};
