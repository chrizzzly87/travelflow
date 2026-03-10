import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AirplaneTilt,
    ArrowRight,
    Bicycle,
    Buildings,
    Bus,
    CalendarBlank,
    CarProfile,
    Check,
    Compass,
    FilePlus,
    ForkKnife,
    Globe,
    Laptop,
    MapPin,
    MoonStars,
    Mountains,
    PersonSimpleWalk,
    Sparkle as Sparkles,
    SpinnerGap as Loader2,
    SunHorizon,
    TextAlignLeft as AlignLeft,
    Train,
    User,
    Users,
    UsersFour,
    UsersThree,
    Van,
} from '@phosphor-icons/react';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { MonthSeasonStrip } from '../components/MonthSeasonStrip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import {
    buildWizardItineraryPrompt,
    type WizardGenerateOptions,
} from '../services/geminiService';
import { getDefaultCreateTripModel } from '../config/aiModelCatalog';
import { ITrip, ITimelineItem, TripPrefillData } from '../types';
import {
    addDays,
    encodeTripPrefill,
    generateTripId,
    getDaysDifference,
    getDefaultTripDates,
} from '../utils';
import {
    getDestinationOptionByName,
    getDestinationPromptLabel,
    getDestinationSeasonCountryName,
    isIslandDestination,
    resolveDestinationName,
} from '../services/destinationService';
import { decodeTripPrefill } from '../services/tripPrefillDecoder';
import { TripView } from '../components/TripView';
import { TripGenerationSkeleton } from '../components/TripGenerationSkeleton';
import { startClientAsyncTripGeneration } from '../services/tripGenerationClientAsyncService';
import {
    createTripGenerationInputSnapshot,
    createTripGenerationRequestId,
    markTripGenerationFailed,
} from '../services/tripGenerationDiagnosticsService';
import {
    buildLoginPathWithNext,
    rememberAuthReturnPath,
    setPendingAuthRedirect,
} from '../services/authNavigationService';
import { ensureDbSession } from '../services/dbService';
import { createTripGenerationRequest } from '../services/tripGenerationQueueService';
import { useAuth } from '../hooks/useAuth';
import { HeroWebGLBackground } from '../components/HeroWebGLBackground';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { FlagIcon } from '../components/flags/FlagIcon';
import {
    getCommonBestMonths,
    getDurationRecommendation,
    monthRangeBetweenDates,
    MONTH_LABELS,
} from '../data/countryTravelData';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    type CreateTripCoupleOccasion,
    type CreateTripFlexWindow,
    type CreateTripFriendsEnergy,
    type CreateTripPrefillDraft,
    type CreateTripTransportPreference,
    type CreateTripTravelerComfort,
    type CreateTripTravelerGender,
    type CreateTripTravelerType,
    type CreateTripWizardBranch,
    isCreateTripCoupleOccasion,
    isCreateTripDateInputMode,
    isCreateTripFlexWindow,
    isCreateTripFriendsEnergy,
    isCreateTripTransportPreference,
    isCreateTripTravelerComfort,
    isCreateTripTravelerGender,
    isCreateTripTravelerType,
    isCreateTripWizardBranch,
} from '../shared/createTripPreferences';

interface CreateTripV3PageProps {
    onTripGenerated: (trip: ITrip) => void;
    onOpenManager: () => void;
}

type BudgetType = 'Low' | 'Medium' | 'High' | 'Luxury';
type PaceType = 'Relaxed' | 'Balanced' | 'Fast';
type FlexWindow = CreateTripFlexWindow;
type TravelerType = CreateTripTravelerType;
type TransportMode = CreateTripTransportPreference;
type TravelerGender = CreateTripTravelerGender;
type TravelerComfort = CreateTripTravelerComfort;
type FriendsEnergy = CreateTripFriendsEnergy;
type CoupleOccasion = CreateTripCoupleOccasion;
type WizardStepId = 'intent' | 'destinations' | 'dates' | 'preferences' | 'details' | 'review';
type SeasonQuality = 'great' | 'shoulder' | 'off';

type ChoiceOption<TId extends string> = {
    id: TId;
    labelKey: string;
    icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular' | 'bold' | 'thin' | 'light' }>;
};

type IntentOption = {
    id: CreateTripWizardBranch;
    icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular' | 'bold' | 'thin' | 'light' }>;
    titleKey: string;
    descriptionKey: string;
};

const NOOP = () => {};
const BUDGET_OPTIONS: BudgetType[] = ['Low', 'Medium', 'High', 'Luxury'];
const FLEX_WINDOW_MONTHS: Record<FlexWindow, number[]> = {
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    winter: [12, 1, 2],
    shoulder: [4, 5, 9, 10],
};
const POPULAR_PICKS = ['Japan', 'Italy', 'Thailand', 'Portugal', 'Greece', 'New Zealand', 'Morocco', 'South Korea'];

const INTENT_OPTIONS: IntentOption[] = [
    {
        id: 'known_destinations_exact_dates',
        icon: Globe,
        titleKey: 'wizard.intent.options.known_destinations_exact_dates.title',
        descriptionKey: 'wizard.intent.options.known_destinations_exact_dates.description',
    },
    {
        id: 'known_destinations_flexible_dates',
        icon: Compass,
        titleKey: 'wizard.intent.options.known_destinations_flexible_dates.title',
        descriptionKey: 'wizard.intent.options.known_destinations_flexible_dates.description',
    },
    {
        id: 'known_dates_need_destination',
        icon: CalendarBlank,
        titleKey: 'wizard.intent.options.known_dates_need_destination.title',
        descriptionKey: 'wizard.intent.options.known_dates_need_destination.description',
    },
    {
        id: 'need_inspiration',
        icon: Sparkles,
        titleKey: 'wizard.intent.options.need_inspiration.title',
        descriptionKey: 'wizard.intent.options.need_inspiration.description',
    },
];

const BRANCH_STEPS: Record<CreateTripWizardBranch, WizardStepId[]> = {
    known_destinations_exact_dates: ['destinations', 'dates', 'preferences', 'details', 'review'],
    known_destinations_flexible_dates: ['destinations', 'dates', 'preferences', 'details', 'review'],
    known_dates_need_destination: ['dates', 'destinations', 'preferences', 'details', 'review'],
    need_inspiration: ['preferences', 'destinations', 'dates', 'details', 'review'],
};

const STYLE_CHOICES: Array<ChoiceOption<string>> = [
    { id: 'culture', labelKey: 'style.options.culture', icon: Buildings },
    { id: 'food', labelKey: 'style.options.food', icon: ForkKnife },
    { id: 'nature', labelKey: 'style.options.nature', icon: Mountains },
    { id: 'beaches', labelKey: 'style.options.beaches', icon: SunHorizon },
    { id: 'nightlife', labelKey: 'style.options.nightlife', icon: MoonStars },
    { id: 'remote-work', labelKey: 'style.options.remoteWork', icon: Laptop },
];

const VIBE_CHOICES: Array<ChoiceOption<string>> = [
    { id: 'food', labelKey: 'wizard.vibes.options.food', icon: ForkKnife },
    { id: 'culture', labelKey: 'wizard.vibes.options.culture', icon: Buildings },
    { id: 'nature', labelKey: 'wizard.vibes.options.nature', icon: Mountains },
    { id: 'adventure', labelKey: 'wizard.vibes.options.adventure', icon: Compass },
    { id: 'relaxation', labelKey: 'wizard.vibes.options.relaxation', icon: SunHorizon },
    { id: 'nightlife', labelKey: 'wizard.vibes.options.nightlife', icon: MoonStars },
];

const TRANSPORT_OPTIONS: Array<ChoiceOption<TransportMode>> = [
    { id: 'auto', labelKey: 'transport.options.auto', icon: Sparkles },
    { id: 'plane', labelKey: 'transport.options.plane', icon: AirplaneTilt },
    { id: 'car', labelKey: 'transport.options.car', icon: CarProfile },
    { id: 'train', labelKey: 'transport.options.train', icon: Train },
    { id: 'bus', labelKey: 'transport.options.bus', icon: Bus },
    { id: 'cycle', labelKey: 'transport.options.cycle', icon: Bicycle },
    { id: 'walk', labelKey: 'transport.options.walk', icon: PersonSimpleWalk },
    { id: 'camper', labelKey: 'transport.options.camper', icon: Van },
];

const TRAVELER_OPTIONS: Array<ChoiceOption<TravelerType>> = [
    { id: 'solo', labelKey: 'traveler.options.solo', icon: User },
    { id: 'couple', labelKey: 'traveler.options.couple', icon: Users },
    { id: 'friends', labelKey: 'traveler.options.friends', icon: UsersThree },
    { id: 'family', labelKey: 'traveler.options.family', icon: UsersFour },
];

const TRAVELER_GENDER_OPTIONS: Array<{ id: Exclude<TravelerGender, ''> | 'unspecified'; labelKey: string }> = [
    { id: 'unspecified', labelKey: 'traveler.settings.notSpecified' },
    { id: 'female', labelKey: 'traveler.settings.genderFemale' },
    { id: 'male', labelKey: 'traveler.settings.genderMale' },
    { id: 'non-binary', labelKey: 'traveler.settings.genderNonBinary' },
    { id: 'prefer-not', labelKey: 'traveler.settings.genderPreferNot' },
];

const COUPLE_OCCASION_OPTIONS: Array<{ id: CoupleOccasion; labelKey: string }> = [
    { id: 'none', labelKey: 'traveler.settings.occasionOptions.none' },
    { id: 'honeymoon', labelKey: 'traveler.settings.occasionOptions.honeymoon' },
    { id: 'anniversary', labelKey: 'traveler.settings.occasionOptions.anniversary' },
    { id: 'city-break', labelKey: 'traveler.settings.occasionOptions.cityBreak' },
];

const FLEX_WINDOW_OPTIONS: Array<{ id: FlexWindow; labelKey: string }> = [
    { id: 'spring', labelKey: 'dates.flexWindow.options.spring' },
    { id: 'summer', labelKey: 'dates.flexWindow.options.summer' },
    { id: 'autumn', labelKey: 'dates.flexWindow.options.autumn' },
    { id: 'winter', labelKey: 'dates.flexWindow.options.winter' },
    { id: 'shoulder', labelKey: 'dates.flexWindow.options.shoulder' },
];

const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const monthLabelsFromNumbers = (months: number[]): string[] =>
    months.filter((month) => month >= 1 && month <= 12).map((month) => MONTH_LABELS[month - 1]);

const formatDestinationList = (destinations: string[]): string => {
    if (destinations.length === 0) return '—';
    if (destinations.length === 1) return destinations[0];
    if (destinations.length === 2) return `${destinations[0]} & ${destinations[1]}`;
    return `${destinations.slice(0, -1).join(', ')} & ${destinations[destinations.length - 1]}`;
};

const inferWizardBranch = (params: {
    countries: string[];
    dateInputMode: 'exact' | 'flex';
    hasDateRange: boolean;
}): CreateTripWizardBranch => {
    if (params.countries.length > 0 && params.dateInputMode === 'flex') {
        return 'known_destinations_flexible_dates';
    }
    if (params.countries.length > 0) {
        return 'known_destinations_exact_dates';
    }
    if (params.hasDateRange) {
        return 'known_dates_need_destination';
    }
    return 'need_inspiration';
};

const buildPreviewTrip = (params: {
    destination: string;
    startDate: string;
    endDate: string;
    tripId?: string;
    title?: string;
    stopTitle: (index: number) => string;
    stopDescription: string;
    locationFallback: string;
    titleFallback: string;
}): ITrip => {
    const now = Date.now();
    const totalDays = getDaysDifference(params.startDate, params.endDate);
    const cityCount = Math.max(1, Math.min(4, Math.max(2, Math.round(totalDays / 4))));
    const baseDuration = Math.floor(totalDays / cityCount);
    const remainder = totalDays % cityCount;
    let offset = 0;
    const items: ITimelineItem[] = Array.from({ length: cityCount }).map((_, index) => {
        const duration = baseDuration + (index < remainder ? 1 : 0);
        const item: ITimelineItem = {
            id: `loading-city-${index}-${now}`,
            type: 'city',
            title: params.stopTitle(index + 1),
            startDateOffset: offset,
            duration,
            color: 'bg-slate-100 border-slate-200 text-slate-400',
            description: params.stopDescription,
            location: params.destination || params.locationFallback,
            loading: true,
        };
        offset += duration;
        return item;
    });
    return {
        id: params.tripId || `trip-preview-${now}`,
        title: params.title || params.destination || params.titleFallback,
        startDate: params.startDate,
        items,
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
    };
};

const NumberStepper: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
}> = ({ label, value, min, max, onChange }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{label}</div>
        <div className="mt-3 flex items-center justify-between gap-3">
            <button
                type="button"
                onClick={() => onChange(clampNumber(value - 1, min, max))}
                disabled={value <= min}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                -
            </button>
            <span className="min-w-[2ch] text-center text-lg font-semibold text-slate-900">{value}</span>
            <button
                type="button"
                onClick={() => onChange(clampNumber(value + 1, min, max))}
                disabled={value >= max}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                +
            </button>
        </div>
    </div>
);

const StepDots: React.FC<{
    currentStep: number;
    totalSteps: number;
    onStepClick: (step: number) => void;
}> = ({ currentStep, totalSteps, onStepClick }) => (
    <div className="mb-4 flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
            const isActive = currentStep === index;
            const isCompleted = index < currentStep;
            return (
                <button
                    key={`wizard-step-${index}`}
                    type="button"
                    onClick={() => index <= currentStep && onStepClick(index)}
                    disabled={index > currentStep}
                    className={[
                        'h-2.5 rounded-full transition-all',
                        isActive ? 'w-8 bg-accent-600' : isCompleted ? 'w-3 bg-accent-300 hover:bg-accent-400' : 'w-3 bg-slate-200',
                        index > currentStep ? 'cursor-default' : '',
                    ].join(' ')}
                    aria-label={`${index + 1}/${totalSteps}`}
                />
            );
        })}
    </div>
);

export const CreateTripV3Page: React.FC<CreateTripV3PageProps> = ({ onTripGenerated, onOpenManager }) => {
    const { t, i18n } = useTranslation('createTrip');
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const [searchParams] = useSearchParams();
    const defaultDates = getDefaultTripDates();

    const [wizardBranch, setWizardBranch] = useState<CreateTripWizardBranch | null>(null);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [startDestination, setStartDestination] = useState('');
    const [dateInputMode, setDateInputMode] = useState<'exact' | 'flex'>('exact');
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [flexWeeks, setFlexWeeks] = useState(2);
    const [flexWindow, setFlexWindow] = useState<FlexWindow>('shoulder');
    const [isRoundTrip, setIsRoundTrip] = useState(true);
    const [routeLock, setRouteLock] = useState(false);

    const [travelerType, setTravelerType] = useState<TravelerType>('solo');
    const [soloGender, setSoloGender] = useState<TravelerGender>('');
    const [soloAge, setSoloAge] = useState('');
    const [soloComfort, setSoloComfort] = useState<TravelerComfort>('balanced');
    const [coupleTravelerA, setCoupleTravelerA] = useState<TravelerGender>('');
    const [coupleTravelerB, setCoupleTravelerB] = useState<TravelerGender>('');
    const [coupleOccasion, setCoupleOccasion] = useState<CoupleOccasion>('none');
    const [friendsCount, setFriendsCount] = useState(4);
    const [friendsEnergy, setFriendsEnergy] = useState<FriendsEnergy>('mixed');
    const [familyAdults, setFamilyAdults] = useState(2);
    const [familyChildren, setFamilyChildren] = useState(1);
    const [familyBabies, setFamilyBabies] = useState(0);

    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
    const [transportModes, setTransportModes] = useState<TransportMode[]>(['auto']);
    const [hasTransportOverride, setHasTransportOverride] = useState(false);

    const [budget, setBudget] = useState<BudgetType>('Medium');
    const [pace, setPace] = useState<PaceType>('Balanced');
    const [specificCities, setSpecificCities] = useState('');
    const [notes, setNotes] = useState('');
    const [enforceIslandOnly, setEnforceIslandOnly] = useState(true);

    const [prefillMeta, setPrefillMeta] = useState<TripPrefillData['meta'] | null>(null);
    const [prefillHydrated, setPrefillHydrated] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [previewTrip, setPreviewTrip] = useState<ITrip | null>(null);
    const [generationSummary, setGenerationSummary] = useState<{ destination: string; startDate: string; endDate: string }>({
        destination: '',
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
    });

    const regionDisplayNames = useMemo(() => {
        try {
            return new Intl.DisplayNames([i18n.language], { type: 'region' });
        } catch {
            return null;
        }
    }, [i18n.language]);

    const getLocalizedCountryName = useCallback((countryCode: string | undefined, fallback: string): string => {
        if (!countryCode || countryCode.length !== 2 || !regionDisplayNames) return fallback;
        return regionDisplayNames.of(countryCode.toUpperCase()) || fallback;
    }, [regionDisplayNames]);

    const getLocalizedDestinationLabel = useCallback((destinationName: string): string => {
        const destination = getDestinationOptionByName(destinationName);
        if (!destination) return destinationName;
        if (destination.kind === 'country') return getLocalizedCountryName(destination.code, destination.name);
        return destination.name;
    }, [getLocalizedCountryName]);

    const steps = useMemo<WizardStepId[]>(
        () => ['intent', ...(wizardBranch ? BRANCH_STEPS[wizardBranch] : [])],
        [wizardBranch]
    );
    const currentStepId = steps[currentStepIndex] || 'intent';

    const orderedDestinations = useMemo(() => {
        if (selectedCountries.length === 0) return [];
        const effectiveStart = startDestination && selectedCountries.includes(startDestination) ? startDestination : selectedCountries[0];
        const startIndex = selectedCountries.indexOf(effectiveStart);
        if (startIndex <= 0) return selectedCountries;
        return [...selectedCountries.slice(startIndex), ...selectedCountries.slice(0, startIndex)];
    }, [selectedCountries, startDestination]);

    const seasonCountryNames = useMemo(() => {
        const seen = new Set<string>();
        return selectedCountries
            .map((country) => getDestinationSeasonCountryName(country))
            .filter((countryName) => {
                const key = countryName.toLocaleLowerCase();
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

    const totalDays = useMemo(
        () => (dateInputMode === 'flex' ? Math.max(7, flexWeeks * 7) : getDaysDifference(startDate, endDate)),
        [dateInputMode, endDate, flexWeeks, startDate]
    );

    const commonMonths = useMemo(
        () => getCommonBestMonths(seasonCountryNames),
        [seasonCountryNames]
    );
    const durationRec = useMemo(
        () => getDurationRecommendation(seasonCountryNames, selectedStyles),
        [seasonCountryNames, selectedStyles]
    );

    const seasonQuality = useMemo(() => {
        if (seasonCountryNames.length === 0) return null;
        const travelMonths = dateInputMode === 'exact'
            ? monthRangeBetweenDates(startDate, endDate)
            : FLEX_WINDOW_MONTHS[flexWindow];
        if (travelMonths.length === 0) return null;
        const overlap = getCommonBestMonths(seasonCountryNames);
        const idealOverlap = travelMonths.filter((month) => overlap.ideal.includes(month)).length;
        const shoulderOverlap = travelMonths.filter((month) => overlap.shoulder.includes(month)).length;
        const ratio = (idealOverlap + shoulderOverlap * 0.5) / travelMonths.length;
        if (ratio >= 0.6) return { quality: 'great' as SeasonQuality, label: t('wizard.dates.seasonFit.great') };
        if (ratio >= 0.3) return { quality: 'shoulder' as SeasonQuality, label: t('wizard.dates.seasonFit.shoulder') };
        return { quality: 'off' as SeasonQuality, label: t('wizard.dates.seasonFit.off') };
    }, [dateInputMode, endDate, flexWindow, seasonCountryNames, startDate, t]);

    const travelerDetails = useMemo(() => ({
        soloGender,
        soloAge,
        soloComfort,
        coupleTravelerA,
        coupleTravelerB,
        coupleOccasion,
        friendsCount,
        friendsEnergy,
        familyAdults,
        familyChildren,
        familyBabies,
    }), [
        coupleOccasion,
        coupleTravelerA,
        coupleTravelerB,
        familyAdults,
        familyBabies,
        familyChildren,
        friendsCount,
        friendsEnergy,
        soloAge,
        soloComfort,
        soloGender,
    ]);

    const travelerDetailSummary = useMemo(() => {
        const getGenderLabel = (gender: TravelerGender): string => {
            if (gender === 'female') return t('traveler.settings.genderFemale');
            if (gender === 'male') return t('traveler.settings.genderMale');
            if (gender === 'non-binary') return t('traveler.settings.genderNonBinary');
            if (gender === 'prefer-not') return t('traveler.settings.genderPreferNot');
            return '';
        };

        if (travelerType === 'solo') {
            const details = [getGenderLabel(soloGender), soloAge || '', t(`traveler.settings.comfortOptions.${soloComfort}`)]
                .filter(Boolean);
            return details.join(', ');
        }

        if (travelerType === 'couple') {
            const details: string[] = [];
            const travelerA = getGenderLabel(coupleTravelerA);
            const travelerB = getGenderLabel(coupleTravelerB);
            if (travelerA && travelerB) details.push(`${travelerA} + ${travelerB}`);
            if (coupleOccasion !== 'none') {
                details.push(t(`traveler.settings.occasionOptions.${coupleOccasion === 'city-break' ? 'cityBreak' : coupleOccasion}`));
            }
            return details.join(', ');
        }

        if (travelerType === 'friends') {
            return `${friendsCount}, ${t(`traveler.settings.energyOptions.${friendsEnergy}`)}`;
        }

        return [
            `${familyAdults} ${t('traveler.settings.adults')}`,
            `${familyChildren} ${t('traveler.settings.children')}`,
            `${familyBabies} ${t('traveler.settings.babies')}`,
        ].join(', ');
    }, [
        coupleOccasion,
        coupleTravelerA,
        coupleTravelerB,
        familyAdults,
        familyBabies,
        familyChildren,
        friendsCount,
        friendsEnergy,
        soloAge,
        soloComfort,
        soloGender,
        t,
        travelerType,
    ]);

    const travelerSummary = useMemo(() => {
        const label = t(`traveler.options.${travelerType}`);
        return travelerDetailSummary ? `${label} (${travelerDetailSummary})` : label;
    }, [t, travelerDetailSummary, travelerType]);

    const styleSummary = useMemo(
        () => selectedStyles
            .map((styleId) => STYLE_CHOICES.find((entry) => entry.id === styleId))
            .filter((entry): entry is ChoiceOption<string> => Boolean(entry))
            .map((entry) => t(entry.labelKey))
            .join(', '),
        [selectedStyles, t]
    );

    const vibeSummary = useMemo(
        () => selectedVibes
            .map((vibeId) => VIBE_CHOICES.find((entry) => entry.id === vibeId))
            .filter((entry): entry is ChoiceOption<string> => Boolean(entry))
            .map((entry) => t(entry.labelKey))
            .join(', '),
        [selectedVibes, t]
    );

    const transportSummary = useMemo(
        () => transportModes
            .map((mode) => TRANSPORT_OPTIONS.find((entry) => entry.id === mode))
            .filter((entry): entry is ChoiceOption<TransportMode> => Boolean(entry))
            .map((entry) => t(entry.labelKey))
            .join(', '),
        [t, transportModes]
    );

    const routeSummary = useMemo(() => {
        const labels = orderedDestinations.map((destination) => getLocalizedDestinationLabel(destination));
        if (labels.length === 0) return '—';
        if (!routeLock) return formatDestinationList(labels);
        if (!isRoundTrip) return labels.join(' → ');
        return [...labels, labels[0]].join(' → ');
    }, [getLocalizedDestinationLabel, isRoundTrip, orderedDestinations, routeLock]);

    const dateModeLocked = useMemo<'exact' | 'flex' | null>(() => {
        if (wizardBranch === 'known_destinations_exact_dates' || wizardBranch === 'known_dates_need_destination') return 'exact';
        if (wizardBranch === 'known_destinations_flexible_dates') return 'flex';
        return null;
    }, [wizardBranch]);

    const dateSummary = useMemo(() => {
        if (dateInputMode === 'exact') {
            return `${new Date(`${startDate}T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(`${endDate}T00:00:00`).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' })} (${t('snapshot.days', { days: totalDays })})`;
        }
        return t('wizard.review.flexDates', {
            weeks: flexWeeks,
            window: t(FLEX_WINDOW_OPTIONS.find((entry) => entry.id === flexWindow)?.labelKey || 'dates.flexWindow.options.shoulder'),
            days: totalDays,
        });
    }, [dateInputMode, endDate, flexWeeks, flexWindow, i18n.language, startDate, t, totalDays]);

    const draftMeta = useMemo<CreateTripPrefillDraft>(() => ({
        version: 2,
        wizardBranch: wizardBranch || undefined,
        dateInputMode,
        flexWeeks,
        flexWindow,
        startDestination,
        destinationOrder: orderedDestinations,
        routeLock,
        travelerType,
        travelerDetails,
        tripStyleTags: selectedStyles,
        tripVibeTags: selectedVibes,
        transportPreferences: transportModes,
        hasTransportOverride,
        specificCities: specificCities.trim() || undefined,
        notes: notes.trim() || undefined,
        selectedIslandNames,
        enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
        idealMonths: monthLabelsFromNumbers(commonMonths.ideal),
        shoulderMonths: monthLabelsFromNumbers(commonMonths.shoulder),
        recommendedDurationDays: durationRec.recommended,
    }), [
        commonMonths.ideal,
        commonMonths.shoulder,
        dateInputMode,
        durationRec.recommended,
        enforceIslandOnly,
        flexWeeks,
        flexWindow,
        hasIslandSelection,
        hasTransportOverride,
        notes,
        orderedDestinations,
        routeLock,
        selectedIslandNames,
        selectedStyles,
        selectedVibes,
        specificCities,
        startDestination,
        transportModes,
        travelerDetails,
        travelerType,
        wizardBranch,
    ]);

    const hasPersistableState = useMemo(() => {
        const hasTravelerOverrides = travelerType !== 'solo'
            || soloGender !== ''
            || soloAge.trim() !== ''
            || soloComfort !== 'balanced'
            || coupleTravelerA !== ''
            || coupleTravelerB !== ''
            || coupleOccasion !== 'none'
            || friendsCount !== 4
            || friendsEnergy !== 'mixed'
            || familyAdults !== 2
            || familyChildren !== 1
            || familyBabies !== 0;
        return Boolean(wizardBranch)
            || selectedCountries.length > 0
            || startDate !== defaultDates.startDate
            || endDate !== defaultDates.endDate
            || dateInputMode !== 'exact'
            || flexWeeks !== 2
            || flexWindow !== 'shoulder'
            || !isRoundTrip
            || routeLock
            || selectedStyles.length > 0
            || selectedVibes.length > 0
            || hasTransportOverride
            || budget !== 'Medium'
            || pace !== 'Balanced'
            || specificCities.trim().length > 0
            || notes.trim().length > 0
            || hasTravelerOverrides;
    }, [
        budget,
        coupleOccasion,
        coupleTravelerA,
        coupleTravelerB,
        dateInputMode,
        defaultDates.endDate,
        defaultDates.startDate,
        endDate,
        familyAdults,
        familyBabies,
        familyChildren,
        flexWeeks,
        flexWindow,
        friendsCount,
        friendsEnergy,
        hasTransportOverride,
        isRoundTrip,
        notes,
        pace,
        routeLock,
        selectedCountries.length,
        selectedStyles.length,
        selectedVibes.length,
        soloAge,
        soloComfort,
        soloGender,
        specificCities,
        startDate,
        travelerType,
        wizardBranch,
    ]);

    useEffect(() => {
        if (dateInputMode !== 'flex') return;
        const start = new Date(`${startDate}T00:00:00`);
        const computedEndDate = toIsoDate(addDays(start, Math.max(0, flexWeeks * 7 - 1)));
        if (computedEndDate !== endDate) {
            setEndDate(computedEndDate);
        }
    }, [dateInputMode, endDate, flexWeeks, startDate]);

    useEffect(() => {
        if (!selectedCountries.length) {
            setStartDestination('');
            return;
        }
        if (!startDestination || !selectedCountries.includes(startDestination)) {
            setStartDestination(selectedCountries[0] || '');
        }
    }, [selectedCountries, startDestination]);

    useEffect(() => {
        if (hasIslandSelection) return;
        setEnforceIslandOnly(true);
    }, [hasIslandSelection]);

    useEffect(() => {
        if (!wizardBranch) return;
        if (dateModeLocked) {
            setDateInputMode(dateModeLocked);
        }
    }, [dateModeLocked, wizardBranch]);

    useEffect(() => {
        if (currentStepIndex <= steps.length - 1) return;
        setCurrentStepIndex(steps.length - 1);
    }, [currentStepIndex, steps.length]);

    useEffect(() => {
        const raw = searchParams.get('prefill');
        if (!raw) {
            setPrefillHydrated(true);
            return;
        }

        const data = decodeTripPrefill(raw);
        if (!data) {
            setPrefillHydrated(true);
            return;
        }

        if (data.countries?.length) setSelectedCountries(data.countries);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.budget) setBudget(data.budget as BudgetType);
        if (data.pace) setPace(data.pace as PaceType);
        if (data.cities) setSpecificCities(data.cities);
        if (data.notes) setNotes(data.notes);
        if (typeof data.roundTrip === 'boolean') setIsRoundTrip(data.roundTrip);
        if (Array.isArray(data.styles)) {
            const knownStyles = new Set(STYLE_CHOICES.map((entry) => entry.id));
            setSelectedStyles(data.styles.filter((styleId) => knownStyles.has(styleId)));
        }
        if (Array.isArray(data.vibes)) {
            const knownVibes = new Set(VIBE_CHOICES.map((entry) => entry.id));
            setSelectedVibes(data.vibes.filter((vibeId) => knownVibes.has(vibeId)));
        }

        const safeMeta = data.meta && typeof data.meta === 'object' && !Array.isArray(data.meta)
            ? data.meta as Record<string, unknown>
            : null;
        const rawDraft = safeMeta?.draft;
        const draft = rawDraft && typeof rawDraft === 'object' && !Array.isArray(rawDraft)
            ? rawDraft as Partial<CreateTripPrefillDraft & {
                transportModes?: TransportMode[];
                soloGender?: TravelerGender;
                soloAge?: string;
                soloComfort?: TravelerComfort;
                coupleTravelerA?: TravelerGender;
                coupleTravelerB?: TravelerGender;
                coupleOccasion?: CoupleOccasion;
                friendsCount?: number;
                friendsEnergy?: FriendsEnergy;
                familyAdults?: number;
                familyChildren?: number;
                familyBabies?: number;
            }>
            : null;

        if (safeMeta) {
            const label = typeof safeMeta.label === 'string' ? safeMeta.label : undefined;
            const source = typeof safeMeta.source === 'string' ? safeMeta.source : undefined;
            const author = typeof safeMeta.author === 'string' ? safeMeta.author : undefined;
            if (label || source || author) {
                setPrefillMeta({ label, source, author });
            }
        }

        let resolvedDateMode: 'exact' | 'flex' = 'exact';
        if (draft?.dateInputMode && isCreateTripDateInputMode(draft.dateInputMode)) {
            resolvedDateMode = draft.dateInputMode;
            setDateInputMode(draft.dateInputMode);
        }
        if (draft && typeof draft.flexWeeks === 'number' && Number.isFinite(draft.flexWeeks)) {
            setFlexWeeks(clampNumber(Math.round(draft.flexWeeks), 1, 8));
        }
        if (draft?.flexWindow && isCreateTripFlexWindow(draft.flexWindow)) {
            setFlexWindow(draft.flexWindow);
        }
        if (draft && typeof draft.startDestination === 'string') {
            setStartDestination(draft.startDestination);
        }
        if (draft && typeof draft.routeLock === 'boolean') {
            setRouteLock(draft.routeLock);
        }
        if (draft?.travelerType && isCreateTripTravelerType(draft.travelerType)) {
            setTravelerType(draft.travelerType);
        }
        if (Array.isArray(draft?.tripStyleTags)) {
            const knownStyles = new Set(STYLE_CHOICES.map((entry) => entry.id));
            setSelectedStyles(draft.tripStyleTags.filter((styleId) => knownStyles.has(styleId)));
        }
        if (Array.isArray(draft?.tripVibeTags)) {
            const knownVibes = new Set(VIBE_CHOICES.map((entry) => entry.id));
            setSelectedVibes(draft.tripVibeTags.filter((vibeId) => knownVibes.has(vibeId)));
        }
        const preferredTransportModes = Array.isArray(draft?.transportPreferences)
            ? draft.transportPreferences
            : draft?.transportModes;
        if (Array.isArray(preferredTransportModes)) {
            const validModes = preferredTransportModes.filter(isCreateTripTransportPreference);
            if (validModes.length > 0) setTransportModes(validModes);
        }
        if (draft && typeof draft.hasTransportOverride === 'boolean') {
            setHasTransportOverride(draft.hasTransportOverride);
        }

        const travelerDraft = draft?.travelerDetails && typeof draft.travelerDetails === 'object' && !Array.isArray(draft.travelerDetails)
            ? draft.travelerDetails
            : {};

        const soloGenderValue = travelerDraft?.soloGender ?? draft?.soloGender;
        if (isCreateTripTravelerGender(soloGenderValue)) setSoloGender(soloGenderValue);
        if (typeof (travelerDraft?.soloAge ?? draft?.soloAge) === 'string') setSoloAge((travelerDraft?.soloAge ?? draft?.soloAge) as string);
        const soloComfortValue = travelerDraft?.soloComfort ?? draft?.soloComfort;
        if (isCreateTripTravelerComfort(soloComfortValue)) setSoloComfort(soloComfortValue);

        const coupleTravelerAValue = travelerDraft?.coupleTravelerA ?? draft?.coupleTravelerA;
        if (isCreateTripTravelerGender(coupleTravelerAValue)) setCoupleTravelerA(coupleTravelerAValue);
        const coupleTravelerBValue = travelerDraft?.coupleTravelerB ?? draft?.coupleTravelerB;
        if (isCreateTripTravelerGender(coupleTravelerBValue)) setCoupleTravelerB(coupleTravelerBValue);
        const coupleOccasionValue = travelerDraft?.coupleOccasion ?? draft?.coupleOccasion;
        if (isCreateTripCoupleOccasion(coupleOccasionValue)) setCoupleOccasion(coupleOccasionValue);

        const friendsCountValue = travelerDraft?.friendsCount ?? draft?.friendsCount;
        if (typeof friendsCountValue === 'number' && Number.isFinite(friendsCountValue)) {
            setFriendsCount(clampNumber(Math.round(friendsCountValue), 2, 12));
        }
        const friendsEnergyValue = travelerDraft?.friendsEnergy ?? draft?.friendsEnergy;
        if (isCreateTripFriendsEnergy(friendsEnergyValue)) setFriendsEnergy(friendsEnergyValue);

        const familyAdultsValue = travelerDraft?.familyAdults ?? draft?.familyAdults;
        if (typeof familyAdultsValue === 'number' && Number.isFinite(familyAdultsValue)) {
            setFamilyAdults(clampNumber(Math.round(familyAdultsValue), 1, 8));
        }
        const familyChildrenValue = travelerDraft?.familyChildren ?? draft?.familyChildren;
        if (typeof familyChildrenValue === 'number' && Number.isFinite(familyChildrenValue)) {
            setFamilyChildren(clampNumber(Math.round(familyChildrenValue), 0, 8));
        }
        const familyBabiesValue = travelerDraft?.familyBabies ?? draft?.familyBabies;
        if (typeof familyBabiesValue === 'number' && Number.isFinite(familyBabiesValue)) {
            setFamilyBabies(clampNumber(Math.round(familyBabiesValue), 0, 4));
        }

        if (draft?.wizardBranch && isCreateTripWizardBranch(draft.wizardBranch)) {
            setWizardBranch(draft.wizardBranch);
        } else {
            setWizardBranch(inferWizardBranch({
                countries: data.countries || [],
                dateInputMode: resolvedDateMode,
                hasDateRange: Boolean(data.startDate && data.endDate),
            }));
        }

        setPrefillHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!prefillHydrated) return;

        const params = new URLSearchParams(window.location.search);
        if (!hasPersistableState) {
            if (!params.has('prefill')) return;
            params.delete('prefill');
            const nextSearch = params.toString();
            window.history.replaceState(window.history.state, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`);
            return;
        }

        const payload: TripPrefillData = {
            countries: selectedCountries.length > 0 ? selectedCountries : undefined,
            startDate,
            endDate,
            budget,
            pace,
            cities: specificCities.trim() || undefined,
            notes: notes.trim() || undefined,
            roundTrip: isRoundTrip,
            mode: 'wizard',
            styles: selectedStyles.length > 0 ? selectedStyles : undefined,
            vibes: selectedVibes.length > 0 ? selectedVibes : undefined,
            meta: {
                ...(typeof prefillMeta?.source === 'string' ? { source: prefillMeta.source } : {}),
                ...(typeof prefillMeta?.author === 'string' ? { author: prefillMeta.author } : {}),
                ...(typeof prefillMeta?.label === 'string' ? { label: prefillMeta.label } : {}),
                draft: draftMeta,
            },
        };

        const encoded = encodeTripPrefill(payload);
        if (params.get('prefill') === encoded) return;
        params.set('prefill', encoded);
        const nextSearch = params.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}?${nextSearch}${window.location.hash}`);
    }, [
        budget,
        draftMeta,
        endDate,
        hasPersistableState,
        isRoundTrip,
        notes,
        pace,
        prefillHydrated,
        prefillMeta?.author,
        prefillMeta?.label,
        prefillMeta?.source,
        selectedCountries,
        selectedStyles,
        selectedVibes,
        specificCities,
        startDate,
    ]);

    const buildVariantUrl = useCallback((path: string) => {
        const payload: TripPrefillData = {
            countries: selectedCountries.length > 0 ? selectedCountries : undefined,
            startDate,
            endDate,
            budget,
            pace,
            cities: specificCities.trim() || undefined,
            notes: notes.trim() || undefined,
            roundTrip: isRoundTrip,
            mode: 'wizard',
            styles: selectedStyles.length > 0 ? selectedStyles : undefined,
            vibes: selectedVibes.length > 0 ? selectedVibes : undefined,
            meta: {
                ...(typeof prefillMeta?.source === 'string' ? { source: prefillMeta.source } : {}),
                ...(typeof prefillMeta?.author === 'string' ? { author: prefillMeta.author } : {}),
                ...(typeof prefillMeta?.label === 'string' ? { label: prefillMeta.label } : {}),
                draft: draftMeta,
            },
        };
        if (!hasPersistableState) return path;
        return `${path}?prefill=${encodeTripPrefill(payload)}`;
    }, [
        budget,
        draftMeta,
        endDate,
        hasPersistableState,
        isRoundTrip,
        notes,
        pace,
        prefillMeta?.author,
        prefillMeta?.label,
        prefillMeta?.source,
        selectedCountries,
        selectedStyles,
        selectedVibes,
        specificCities,
        startDate,
    ]);

    const setCountriesFromString = useCallback((value: string) => {
        setSelectedCountries(
            value
                ? value.split(',').map((entry) => resolveDestinationName(entry.trim())).filter(Boolean)
                : []
        );
    }, []);

    const togglePopularPick = useCallback((name: string) => {
        setSelectedCountries((previous) => {
            const resolved = resolveDestinationName(name);
            if (previous.includes(resolved)) {
                return previous.filter((entry) => entry !== resolved);
            }
            return [...previous, resolved];
        });
    }, []);

    const toggleChip = useCallback((value: string, current: string[], setter: React.Dispatch<React.SetStateAction<string[]>>) => {
        setter(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
    }, []);

    const toggleTransportMode = useCallback((mode: TransportMode) => {
        setTransportModes((previous) => {
            if (mode === 'auto') {
                setHasTransportOverride(false);
                trackEvent('create_trip_wizard__transport--toggle', { mode, enabled: true });
                return ['auto'];
            }

            const nextModes = previous.filter((entry) => entry !== 'auto');
            const enabled = !nextModes.includes(mode);
            const updatedModes = enabled
                ? [...nextModes, mode]
                : nextModes.filter((entry) => entry !== mode);

            if (updatedModes.length === 0) {
                setHasTransportOverride(false);
                trackEvent('create_trip_wizard__transport--toggle', { mode, enabled: false });
                return ['auto'];
            }

            setHasTransportOverride(true);
            trackEvent('create_trip_wizard__transport--toggle', { mode, enabled });
            return updatedModes;
        });
    }, []);

    const selectBranch = useCallback((branch: CreateTripWizardBranch) => {
        setWizardBranch(branch);
        if (branch === 'known_destinations_exact_dates' || branch === 'known_dates_need_destination') {
            setDateInputMode('exact');
        } else if (branch === 'known_destinations_flexible_dates') {
            setDateInputMode('flex');
        }
        setCurrentStepIndex(1);
        trackEvent('create_trip_wizard__branch--select', { branch });
    }, []);

    const goToStep = useCallback((nextIndex: number) => {
        if (nextIndex < 0 || nextIndex > steps.length - 1) return;
        setCurrentStepIndex(nextIndex);
    }, [steps.length]);

    const canContinue = useMemo(() => {
        if (currentStepId === 'intent') return Boolean(wizardBranch);
        if (currentStepId === 'destinations') return selectedCountries.length > 0;
        if (currentStepId === 'dates') return dateInputMode === 'flex' ? flexWeeks > 0 : Boolean(startDate && endDate);
        return true;
    }, [currentStepId, dateInputMode, endDate, flexWeeks, selectedCountries.length, startDate, wizardBranch]);

    const canGenerate = selectedCountries.length > 0 && !isGenerating;

    const handleGenerate = async () => {
        const sessionUserId = await ensureDbSession();
        if (!sessionUserId) {
            const authRedirect = buildLoginPathWithNext({
                pathname: location.pathname,
                search: location.search,
                hash: location.hash,
            });
            rememberAuthReturnPath(authRedirect.nextPath);
            setPendingAuthRedirect(authRedirect.nextPath, 'create_trip_v3_generate');
            navigate(authRedirect.loginTarget);
            return;
        }

        const defaultModel = getDefaultCreateTripModel();
        const destinationLabel = orderedDestinations.map((destination) => getLocalizedDestinationLabel(destination)).join(', ') || t('wizard.flowLabel');

        const wizardOptions: WizardGenerateOptions = {
            countries: orderedDestinations.map((country) => getDestinationPromptLabel(country)),
            startDate,
            endDate,
            roundTrip: isRoundTrip,
            totalDays,
            budget,
            pace,
            interests: notes.split(',').map((token) => token.trim()).filter(Boolean),
            notes: notes.trim() || undefined,
            specificCities: specificCities.trim() || undefined,
            dateInputMode,
            flexWeeks: dateInputMode === 'flex' ? flexWeeks : undefined,
            flexWindow: dateInputMode === 'flex' ? flexWindow : undefined,
            startDestination: startDestination ? getDestinationPromptLabel(startDestination) : undefined,
            destinationOrder: orderedDestinations.map((country) => getDestinationPromptLabel(country)),
            routeLock,
            travelerType,
            travelerDetails,
            tripStyleTags: selectedStyles,
            tripVibeTags: selectedVibes,
            transportPreferences: transportModes,
            hasTransportOverride,
            idealMonths: monthLabelsFromNumbers(commonMonths.ideal),
            shoulderMonths: monthLabelsFromNumbers(commonMonths.shoulder),
            recommendedDurationDays: durationRec.recommended,
            selectedIslandNames,
            enforceIslandOnly: hasIslandSelection ? enforceIslandOnly : undefined,
            aiTarget: {
                provider: defaultModel.provider,
                model: defaultModel.model,
            },
        };

        trackEvent('create_trip_wizard__cta--generate', {
            branch: wizardBranch || 'unknown',
            destination_count: orderedDestinations.length,
            date_mode: dateInputMode,
            traveler_type: travelerType,
            transport_override: hasTransportOverride,
        });

        if (!isAuthenticated) {
            try {
                const queuedRequest = await createTripGenerationRequest('wizard', {
                    version: 1,
                    flow: 'wizard',
                    destinationLabel,
                    startDate,
                    endDate,
                    options: wizardOptions,
                });
                const requestId = createTripGenerationRequestId();
                const optimisticTrip = buildPreviewTrip({
                    destination: destinationLabel,
                    startDate,
                    endDate,
                    tripId: generateTripId(),
                    title: destinationLabel,
                    stopTitle: (index) => t('wizard.loading.stopTitle', { index }),
                    stopDescription: t('wizard.loading.stopDescription'),
                    locationFallback: t('wizard.loading.locationFallback'),
                    titleFallback: t('wizard.loading.titleFallback'),
                });
                const pendingAuthTrip = markTripGenerationFailed({
                    ...optimisticTrip,
                    items: optimisticTrip.items.map((item) => ({
                        ...item,
                        loading: false,
                    })),
                    updatedAt: Date.now(),
                }, {
                    flow: 'wizard',
                    source: 'create_trip_v3_pending_auth',
                    error: new Error('Sign in to start generation for this trip.'),
                    provider: defaultModel.provider,
                    model: defaultModel.model,
                    requestId,
                    metadata: {
                        pendingAuth: true,
                        queueRequestId: queuedRequest.requestId,
                        queueExpiresAt: queuedRequest.expiresAt,
                        orchestration: 'auth_queue_claim',
                        variant: 'v3',
                    },
                });
                onTripGenerated(pendingAuthTrip);
                return;
            } catch {
                const authRedirect = buildLoginPathWithNext({
                    pathname: location.pathname,
                    search: location.search,
                    hash: location.hash,
                });
                rememberAuthReturnPath(authRedirect.nextPath);
                setPendingAuthRedirect(authRedirect.nextPath, 'create_trip_v3_queue_fallback');
                navigate(authRedirect.loginTarget);
                return;
            }
        }

        setPreviewTrip(buildPreviewTrip({
            destination: destinationLabel,
            startDate,
            endDate,
            title: destinationLabel,
            stopTitle: (index) => t('wizard.loading.stopTitle', { index }),
            stopDescription: t('wizard.loading.stopDescription'),
            locationFallback: t('wizard.loading.locationFallback'),
            titleFallback: t('wizard.loading.titleFallback'),
        }));
        setGenerationSummary({ destination: destinationLabel, startDate, endDate });
        setGenerationError(null);
        setIsGenerating(true);

        try {
            const inputSnapshot = createTripGenerationInputSnapshot({
                flow: 'wizard',
                destinationLabel,
                startDate,
                endDate,
                payload: {
                    options: wizardOptions,
                },
            });
            const prompt = buildWizardItineraryPrompt(wizardOptions);
            await startClientAsyncTripGeneration({
                flow: 'wizard',
                source: 'create_trip_v3',
                jobSource: 'create_trip_v3_async',
                destinationLabel,
                startDate,
                roundTrip: isRoundTrip,
                prompt,
                provider: defaultModel.provider,
                model: defaultModel.model,
                inputSnapshot,
                buildOptimisticTrip: (tripId) => buildPreviewTrip({
                    destination: destinationLabel,
                    startDate,
                    endDate,
                    tripId,
                    title: destinationLabel,
                    stopTitle: (index) => t('wizard.loading.stopTitle', { index }),
                    stopDescription: t('wizard.loading.stopDescription'),
                    locationFallback: t('wizard.loading.locationFallback'),
                    titleFallback: t('wizard.loading.titleFallback'),
                }),
                onTripUpdate: onTripGenerated,
                metadata: {
                    variant: 'v3',
                    wizardBranch,
                },
            });
            setPreviewTrip(null);
        } catch (error) {
            setPreviewTrip(null);
            if (error instanceof Error) {
                setGenerationError(error.message || t('errors.genericGenerate'));
            } else {
                setGenerationError(t('errors.genericGenerate'));
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCreateBlank = () => {
        const title = orderedDestinations.map((destination) => getLocalizedDestinationLabel(destination)).join(', ') || t('wizard.flowLabel');
        onTripGenerated({
            id: generateTripId(),
            title,
            startDate,
            items: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            isFavorite: false,
        });
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
                    <div className="w-full max-w-xl rounded-3xl border border-accent-100 bg-white/95 px-5 py-4 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-600">
                                <Loader2 size={18} className="animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-accent-900">{t('wizard.loading.title')}</div>
                                <div className="truncate text-xs text-slate-600">{t('wizard.loading.message')}</div>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                            {generationSummary.destination} • {generationSummary.startDate} - {generationSummary.endDate}
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-accent-500 to-accent-600" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isGenerating) {
        return <TripGenerationSkeleton />;
    }

    const renderTravelerDetails = () => {
        if (travelerType === 'solo') {
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.gender')}</label>
                        <Select value={soloGender || 'unspecified'} onValueChange={(value) => setSoloGender(value === 'unspecified' ? '' : value as TravelerGender)}>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRAVELER_GENDER_OPTIONS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.age')}</label>
                        <input
                            type="text"
                            value={soloAge}
                            onChange={(event) => setSoloAge(event.target.value)}
                            placeholder={t('traveler.settings.agePlaceholder')}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.comfortMode')}</label>
                        <Select
                            value={soloComfort}
                            onValueChange={(value) => setSoloComfort(value as TravelerComfort)}
                        >
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="social">{t('traveler.settings.comfortOptions.social')}</SelectItem>
                                <SelectItem value="balanced">{t('traveler.settings.comfortOptions.balanced')}</SelectItem>
                                <SelectItem value="private">{t('traveler.settings.comfortOptions.private')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        if (travelerType === 'couple') {
            return (
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.travelerA')}</label>
                        <Select value={coupleTravelerA || 'unspecified'} onValueChange={(value) => setCoupleTravelerA(value === 'unspecified' ? '' : value as TravelerGender)}>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRAVELER_GENDER_OPTIONS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.travelerB')}</label>
                        <Select value={coupleTravelerB || 'unspecified'} onValueChange={(value) => setCoupleTravelerB(value === 'unspecified' ? '' : value as TravelerGender)}>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRAVELER_GENDER_OPTIONS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.occasion')}</label>
                        <Select value={coupleOccasion} onValueChange={(value) => setCoupleOccasion(value as CoupleOccasion)}>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COUPLE_OCCASION_OPTIONS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        if (travelerType === 'friends') {
            return (
                <div className="grid gap-3 md:grid-cols-2">
                    <NumberStepper
                        label={t('traveler.settings.groupSize')}
                        value={friendsCount}
                        min={2}
                        max={12}
                        onChange={setFriendsCount}
                    />
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('traveler.settings.groupEnergy')}</label>
                        <Select value={friendsEnergy} onValueChange={(value) => setFriendsEnergy(value as FriendsEnergy)}>
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="chill">{t('traveler.settings.energyOptions.chill')}</SelectItem>
                                <SelectItem value="mixed">{t('traveler.settings.energyOptions.mixed')}</SelectItem>
                                <SelectItem value="full-send">{t('traveler.settings.energyOptions.full-send')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            );
        }

        return (
            <div className="grid gap-3 md:grid-cols-3">
                <NumberStepper
                    label={t('traveler.settings.adults')}
                    value={familyAdults}
                    min={1}
                    max={8}
                    onChange={setFamilyAdults}
                />
                <NumberStepper
                    label={t('traveler.settings.children')}
                    value={familyChildren}
                    min={0}
                    max={8}
                    onChange={setFamilyChildren}
                />
                <NumberStepper
                    label={t('traveler.settings.babies')}
                    value={familyBabies}
                    min={0}
                    max={4}
                    onChange={setFamilyBabies}
                />
            </div>
        );
    };

    const renderStepContent = () => {
        if (currentStepId === 'intent') {
            return (
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-600">{t('wizard.intent.eyebrow')}</div>
                        <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">{t('wizard.intent.title')}</h1>
                        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">{t('wizard.intent.description')}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {INTENT_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const active = wizardBranch === option.id;
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => selectBranch(option.id)}
                                    className={[
                                        'rounded-3xl border p-4 text-start transition-all',
                                        active
                                            ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                            : 'border-slate-200 bg-white hover:border-accent-300 hover:bg-accent-50/60',
                                    ].join(' ')}
                                    {...getAnalyticsDebugAttributes('create_trip_wizard__branch--select', { branch: option.id })}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                            <Icon size={20} weight="duotone" />
                                        </span>
                                        {active && (
                                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-600 text-white">
                                                <Check size={12} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-4 text-base font-semibold text-slate-950">{t(option.titleKey)}</div>
                                    <div className="mt-1 text-sm text-slate-600">{t(option.descriptionKey)}</div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (currentStepId === 'destinations') {
            return (
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-slate-950">{t('wizard.destination.title')}</h2>
                        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                            {wizardBranch === 'known_destinations_exact_dates' || wizardBranch === 'known_destinations_flexible_dates'
                                ? t('wizard.destination.knownDescription')
                                : t('wizard.destination.helpDescription')}
                        </p>
                    </div>

                    <CountrySelect
                        value={selectedCountries.join(', ')}
                        onChange={setCountriesFromString}
                        labels={{
                            fieldLabel: t('destination.title'),
                            placeholder: t('destination.searchPlaceholder'),
                            addAnotherPlaceholder: t('wizard.destination.addAnother'),
                            idealTravelTime: t('destination.idealTravelTime'),
                            islandOf: (country) => t('destination.islandOf', { country }),
                            noMatches: t('destination.noMatches'),
                            typeToSearch: t('wizard.destination.typeToSearch'),
                        }}
                    />

                    <div>
                        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.destination.quickPicks')}</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {POPULAR_PICKS.map((pick) => {
                                const option = getDestinationOptionByName(pick);
                                const active = selectedCountries.includes(pick);
                                return (
                                    <button
                                        key={pick}
                                        type="button"
                                        onClick={() => togglePopularPick(pick)}
                                        className={[
                                            'rounded-2xl border p-3 text-center transition-all',
                                            active
                                                ? 'border-accent-500 bg-accent-50 shadow-sm shadow-accent-100'
                                                : 'border-slate-200 bg-white hover:border-accent-300 hover:bg-accent-50/60',
                                        ].join(' ')}
                                    >
                                        <div className="mb-1 flex justify-center">
                                            <FlagIcon value={option?.flag || '🌍'} size="2xl" />
                                        </div>
                                        <div className="text-sm font-semibold text-slate-900">{getLocalizedDestinationLabel(pick)}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedCountries.length > 1 && (
                        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.destination.startLabel')}</label>
                                <Select value={startDestination} onValueChange={setStartDestination}>
                                    <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedCountries.map((country) => (
                                            <SelectItem key={country} value={country}>{getLocalizedDestinationLabel(country)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">{t('wizard.destination.selectionHint')}</p>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{t('wizard.details.roundTripTitle')}</div>
                                        <div className="mt-1 text-xs text-slate-500">{t('wizard.details.roundTripDescription')}</div>
                                    </div>
                                    <Switch checked={isRoundTrip} onCheckedChange={(value) => setIsRoundTrip(Boolean(value))} />
                                </div>
                                <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{t('wizard.details.routeLockTitle')}</div>
                                        <div className="mt-1 text-xs text-slate-500">{t('wizard.details.routeLockDescription')}</div>
                                    </div>
                                    <Switch checked={routeLock} onCheckedChange={(value) => setRouteLock(Boolean(value))} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (currentStepId === 'dates') {
            return (
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-slate-950">{t('wizard.dates.title')}</h2>
                        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
                            {dateModeLocked === 'exact'
                                ? t('wizard.dates.exactDescription')
                                : dateModeLocked === 'flex'
                                    ? t('wizard.dates.flexDescription')
                                    : t('wizard.dates.hybridDescription')}
                        </p>
                    </div>

                    {!dateModeLocked && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.dates.modeLabel')}</label>
                            <Select
                                value={dateInputMode}
                                onValueChange={(value) => {
                                    setDateInputMode(value as 'exact' | 'flex');
                                    trackEvent('create_trip_wizard__date_mode--select', { mode: value });
                                }}
                            >
                                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="exact">{t('dates.mode.exact')}</SelectItem>
                                    <SelectItem value="flex">{t('dates.mode.flex')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {dateInputMode === 'exact' ? (
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onChange={(nextStartDate, nextEndDate) => {
                                setStartDate(nextStartDate);
                                setEndDate(nextEndDate);
                            }}
                            showLabel={false}
                            monthLabelFormat="long"
                            locale={i18n.language}
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-[1fr,1fr]">
                            <NumberStepper
                                label={t('dates.flexWindow.weeksLabel')}
                                value={flexWeeks}
                                min={1}
                                max={8}
                                onChange={setFlexWeeks}
                            />
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('dates.flexWindow.rangeLabel')}</label>
                                <Select value={flexWindow} onValueChange={(value) => setFlexWindow(value as FlexWindow)}>
                                    <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FLEX_WINDOW_OPTIONS.map((entry) => (
                                            <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                        <span className="inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-3 py-1 font-medium text-accent-700">
                            {dateInputMode === 'exact'
                                ? t('wizard.dates.exactLength', { days: totalDays })
                                : t('wizard.dates.flexLength', { weeks: flexWeeks, days: totalDays })}
                        </span>
                        {seasonQuality && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                                <span
                                    className={[
                                        'inline-block h-2.5 w-2.5 rounded-full',
                                        seasonQuality.quality === 'great'
                                            ? 'bg-emerald-500'
                                            : seasonQuality.quality === 'shoulder'
                                                ? 'bg-amber-500'
                                                : 'bg-rose-400',
                                    ].join(' ')}
                                />
                                {seasonQuality.label}
                            </span>
                        )}
                    </div>

                    {selectedCountries.length > 0 && (commonMonths.ideal.length > 0 || commonMonths.shoulder.length > 0) && (
                        <MonthSeasonStrip idealMonths={commonMonths.ideal} shoulderMonths={commonMonths.shoulder} />
                    )}
                </div>
            );
        }

        if (currentStepId === 'preferences') {
            return (
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-slate-950">{t('wizard.preferences.title')}</h2>
                        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{t('wizard.preferences.description')}</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.preferences.travelerLabel')}</label>
                        <Select
                            value={travelerType}
                            onValueChange={(value) => {
                                setTravelerType(value as TravelerType);
                                trackEvent('create_trip_wizard__traveler--select', { traveler_type: value });
                            }}
                        >
                            <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TRAVELER_OPTIONS.map((entry) => (
                                    <SelectItem key={entry.id} value={entry.id}>{t(entry.labelKey)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">{travelerSummary}</div>
                        {renderTravelerDetails()}
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.preferences.stylesLabel')}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {STYLE_CHOICES.map((entry) => {
                                const Icon = entry.icon;
                                const active = selectedStyles.includes(entry.id);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => toggleChip(entry.id, selectedStyles, setSelectedStyles)}
                                        className={[
                                            'rounded-2xl border px-3 py-3 text-start transition-all',
                                            active
                                                ? 'border-accent-500 bg-accent-50 text-accent-900 shadow-sm shadow-accent-100'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-accent-300 hover:bg-accent-50/60',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Icon size={16} weight="duotone" />
                                            {t(entry.labelKey)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.preferences.vibesLabel')}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {VIBE_CHOICES.map((entry) => {
                                const Icon = entry.icon;
                                const active = selectedVibes.includes(entry.id);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => toggleChip(entry.id, selectedVibes, setSelectedVibes)}
                                        className={[
                                            'rounded-2xl border px-3 py-3 text-start transition-all',
                                            active
                                                ? 'border-accent-500 bg-accent-50 text-accent-900 shadow-sm shadow-accent-100'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-accent-300 hover:bg-accent-50/60',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Icon size={16} weight="duotone" />
                                            {t(entry.labelKey)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.preferences.transportLabel')}</div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            {TRANSPORT_OPTIONS.map((entry) => {
                                const Icon = entry.icon;
                                const active = transportModes.includes(entry.id);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => toggleTransportMode(entry.id)}
                                        className={[
                                            'rounded-2xl border px-3 py-3 text-start transition-all',
                                            active
                                                ? 'border-accent-500 bg-accent-50 text-accent-900 shadow-sm shadow-accent-100'
                                                : 'border-slate-200 bg-white text-slate-700 hover:border-accent-300 hover:bg-accent-50/60',
                                        ].join(' ')}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Icon size={16} weight="duotone" />
                                            {t(entry.labelKey)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-slate-500">{t('wizard.preferences.transportHint')}</p>
                    </div>
                </div>
            );
        }

        if (currentStepId === 'details') {
            return (
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-3xl font-bold text-slate-950">{t('wizard.details.title')}</h2>
                        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{t('wizard.details.description')}</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.details.budgetLabel')}</label>
                            <Select value={budget} onValueChange={(value) => setBudget(value as BudgetType)}>
                                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {BUDGET_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={option}>{t(`wizard.budgetOptions.${option.toLocaleLowerCase()}`)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.details.paceLabel')}</label>
                            <Select value={pace} onValueChange={(value) => setPace(value as PaceType)}>
                                <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Relaxed">{t('wizard.paceOptions.relaxed')}</SelectItem>
                                    <SelectItem value="Balanced">{t('wizard.paceOptions.balanced')}</SelectItem>
                                    <SelectItem value="Fast">{t('wizard.paceOptions.fast')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.details.specificCitiesLabel')}</label>
                        <input
                            type="text"
                            value={specificCities}
                            onChange={(event) => setSpecificCities(event.target.value)}
                            placeholder={t('wizard.details.specificCitiesPlaceholder')}
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('wizard.details.notesLabel')}</label>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={4}
                            placeholder={t('wizard.details.notesPlaceholder')}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                        />
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{t('wizard.details.roundTripTitle')}</div>
                                <div className="mt-1 text-xs text-slate-500">{t('wizard.details.roundTripDescription')}</div>
                            </div>
                            <Switch checked={isRoundTrip} onCheckedChange={(value) => setIsRoundTrip(Boolean(value))} />
                        </div>
                        <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div>
                                <div className="text-sm font-semibold text-slate-900">{t('wizard.details.routeLockTitle')}</div>
                                <div className="mt-1 text-xs text-slate-500">{t('wizard.details.routeLockDescription')}</div>
                            </div>
                            <Switch checked={routeLock} onCheckedChange={(value) => setRouteLock(Boolean(value))} />
                        </div>
                        {hasIslandSelection && (
                            <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">{t('wizard.details.islandOnly')}</div>
                                    <div className="mt-1 text-xs text-slate-500">{selectedIslandNames.map((name) => getLocalizedDestinationLabel(name)).join(', ')}</div>
                                </div>
                                <Switch checked={enforceIslandOnly} onCheckedChange={(value) => setEnforceIslandOnly(Boolean(value))} />
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-slate-950">{t('wizard.review.title')}</h2>
                    <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{t('wizard.review.description')}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Globe size={16} weight="duotone" />
                            {t('destination.title')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{formatDestinationList(orderedDestinations.map((destination) => getLocalizedDestinationLabel(destination)))}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <CalendarBlank size={16} weight="duotone" />
                            {t('dates.title')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{dateSummary}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <UsersThree size={16} weight="duotone" />
                            {t('traveler.title')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{travelerSummary}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Compass size={16} weight="duotone" />
                            {t('wizard.review.route')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{routeSummary}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Sparkles size={16} weight="duotone" />
                            {t('wizard.review.styles')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{styleSummary || t('style.empty')}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <MapPin size={16} weight="duotone" />
                            {t('wizard.review.vibes')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{vibeSummary || '—'}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Train size={16} weight="duotone" />
                            {t('transport.title')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{transportSummary}</div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <AlignLeft size={16} weight="duotone" />
                            {t('notes.title')}
                        </div>
                        <div className="mt-2 text-sm text-slate-600">{notes || t('wizard.review.notesFallback')}</div>
                    </div>
                </div>

                {generationError && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {generationError}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-slate-50">
            <HeroWebGLBackground className="z-0" />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-white/35" />
            <div className="relative z-20">
                <SiteHeader variant="glass" hideCreateTrip onMyTripsClick={onOpenManager} />
            </div>

            <div className="relative z-10 flex flex-1 flex-col items-center px-4 pb-16 pt-8">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                    <span>{t('wizard.flowLabel')}</span>
                    <span className="text-slate-300">•</span>
                    <Link to={buildVariantUrl('/create-trip')} className="font-medium text-accent-700 transition-colors hover:text-accent-900">
                        {t('labsBanner.links.classicCard')}
                    </Link>
                </div>

                <StepDots currentStep={currentStepIndex} totalSteps={steps.length} onStepClick={goToStep} />

                <div className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">
                    {t('wizard.stepBadge', { current: currentStepIndex + 1, total: steps.length })}
                </div>

                <div className="w-full max-w-5xl rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
                    {renderStepContent()}

                    {currentStepId !== 'intent' && (
                        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={() => goToStep(Math.max(0, currentStepIndex - 1))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-900"
                            >
                                {t('wizard.actions.back')}
                            </button>

                            {currentStepId !== 'review' ? (
                                <button
                                    type="button"
                                    onClick={() => goToStep(Math.min(steps.length - 1, currentStepIndex + 1))}
                                    disabled={!canContinue}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/60 transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {t('wizard.actions.continue')}
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={handleCreateBlank}
                                        disabled={selectedCountries.length === 0}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-900 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FilePlus size={16} weight="duotone" />
                                        {t('wizard.actions.blank')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        disabled={!canGenerate}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-200/60 transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        {...getAnalyticsDebugAttributes('create_trip_wizard__cta--generate', {
                                            branch: wizardBranch || 'unknown',
                                            destination_count: orderedDestinations.length,
                                            date_mode: dateInputMode,
                                        })}
                                    >
                                        <Sparkles size={16} weight="duotone" />
                                        {t('wizard.actions.generate')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="relative z-10">
                <SiteFooter />
            </div>
        </div>
    );
};
