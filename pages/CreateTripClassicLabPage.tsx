import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import {
    AirplaneTilt,
    Bicycle,
    Buildings,
    Bus,
    CalendarBlank,
    CarProfile,
    CaretDown,
    CaretUp,
    CheckCircle,
    Compass,
    DotsSixVertical,
    ForkKnife,
    GearSix,
    Info,
    Laptop,
    MagicWand,
    MapPin,
    MagnifyingGlass,
    Minus,
    MoonStars,
    Mountains,
    PersonSimpleWalk,
    Plus,
    Sparkle,
    SunHorizon,
    Train,
    User,
    Users,
    UsersThree,
    UsersFour,
    Van,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { DateRangePicker } from '../components/DateRangePicker';
import { IdealTravelTimeline } from '../components/IdealTravelTimeline';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../components/ui/drawer';
import { Switch } from '../components/ui/switch';
import { useDbSync } from '../hooks/useDbSync';
import { generateItinerary } from '../services/aiService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { getCountrySeasonByName } from '../data/countryTravelData';
import { AppLanguage, ITrip, TripPrefillData } from '../types';
import {
    addDays,
    DESTINATION_OPTIONS,
    decodeTripPrefill,
    getDaysDifference,
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationPromptLabel,
    getDestinationSeasonCountryName,
    resolveDestinationName,
    searchDestinationOptions,
} from '../utils';

interface CreateTripClassicLabPageProps {
    onOpenManager: () => void;
    onTripGenerated: (trip: ITrip) => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}

type BudgetType = 'Low' | 'Medium' | 'High' | 'Luxury';
type PaceType = 'Relaxed' | 'Balanced' | 'Fast';
type DateInputMode = 'exact' | 'flex';
type FlexWindow = 'spring' | 'summer' | 'autumn' | 'winter' | 'shoulder';
type TravelerType = 'solo' | 'couple' | 'friends' | 'family';
type TransportMode = 'auto' | 'plane' | 'car' | 'train' | 'bus' | 'cycle' | 'walk' | 'camper';
type TravelerGender = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';
type CollapsibleSection = 'traveler' | 'style' | 'transport';
type SnapshotRouteGeometry = {
    axisX: number;
    firstY: number;
    lastY: number;
    loopLeft: number;
    segmentMidpoints: number[];
};

type ChoiceOption<TId extends string> = {
    id: TId;
    labelKey: string;
    icon: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'regular' | 'bold' | 'thin' | 'light' }>;
};

const STYLE_CHOICES: Array<ChoiceOption<string>> = [
    { id: 'culture', labelKey: 'style.options.culture', icon: Buildings },
    { id: 'food', labelKey: 'style.options.food', icon: ForkKnife },
    { id: 'nature', labelKey: 'style.options.nature', icon: Mountains },
    { id: 'beaches', labelKey: 'style.options.beaches', icon: SunHorizon },
    { id: 'nightlife', labelKey: 'style.options.nightlife', icon: MoonStars },
    { id: 'remote-work', labelKey: 'style.options.remoteWork', icon: Laptop },
];

const TRANSPORT_OPTIONS: Array<ChoiceOption<TransportMode>> = [
    { id: 'auto', labelKey: 'transport.options.auto', icon: MagicWand },
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

const FLEX_WINDOW_OPTIONS: Array<{ id: FlexWindow; labelKey: string }> = [
    { id: 'spring', labelKey: 'dates.flexWindow.options.spring' },
    { id: 'summer', labelKey: 'dates.flexWindow.options.summer' },
    { id: 'autumn', labelKey: 'dates.flexWindow.options.autumn' },
    { id: 'winter', labelKey: 'dates.flexWindow.options.winter' },
    { id: 'shoulder', labelKey: 'dates.flexWindow.options.shoulder' },
];

const DEFAULT_EFFECTIVE_STYLE_IDS = ['culture', 'food', 'nature', 'beaches', 'nightlife'];
const DEFAULT_EFFECTIVE_TRAVELER: TravelerType = 'solo';
const DEFAULT_EFFECTIVE_TRANSPORT: TransportMode = 'auto';

const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDestinationList = (destinations: string[]): string => {
    if (destinations.length === 0) return '—';
    if (destinations.length === 1) return destinations[0];
    if (destinations.length === 2) return `${destinations[0]} & ${destinations[1]}`;
    return `${destinations.slice(0, -1).join(', ')} & ${destinations[destinations.length - 1]}`;
};

const getInitialDateRange = (): { startDate: string; endDate: string } => {
    const start = addDays(new Date(), 21);
    const end = addDays(start, 9);
    return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
    };
};

const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const NumberStepper: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
}> = ({ label, value, min, max, onChange }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
            <button
                type="button"
                onClick={() => onChange(clampNumber(value - 1, min, max))}
                disabled={value <= min}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Minus size={14} />
            </button>
            <span className="min-w-[2ch] text-center text-sm font-semibold text-slate-800">{value}</span>
            <button
                type="button"
                onClick={() => onChange(clampNumber(value + 1, min, max))}
                disabled={value >= max}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-accent-300 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Plus size={14} />
            </button>
        </div>
    </div>
);

export const CreateTripClassicLabPage: React.FC<CreateTripClassicLabPageProps> = ({
    onOpenManager,
    onTripGenerated,
    onLanguageLoaded,
}) => {
    const { t, i18n } = useTranslation('createTrip');
    const [searchParams] = useSearchParams();

    useDbSync(onLanguageLoaded);

    const initialRange = useMemo(() => getInitialDateRange(), []);

    const [query, setQuery] = useState('');
    const [destinations, setDestinations] = useState<string[]>([]);
    const [startDestination, setStartDestination] = useState<string>('');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const [dateInputMode, setDateInputMode] = useState<DateInputMode>('exact');
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);
    const [flexWeeks, setFlexWeeks] = useState(2);
    const [flexWindow, setFlexWindow] = useState<FlexWindow>('shoulder');

    const [budget, setBudget] = useState<BudgetType>('Medium');
    const [pace, setPace] = useState<PaceType>('Balanced');
    const [roundTrip, setRoundTrip] = useState(true);
    const [routeLock, setRouteLock] = useState(false);

    const [travelerType, setTravelerType] = useState<TravelerType>(DEFAULT_EFFECTIVE_TRAVELER);
    const [selectedStyles, setSelectedStyles] = useState<string[]>(DEFAULT_EFFECTIVE_STYLE_IDS);
    const [transportModes, setTransportModes] = useState<TransportMode[]>([DEFAULT_EFFECTIVE_TRANSPORT]);
    const [hasTransportOverride, setHasTransportOverride] = useState(false);

    const [soloGender, setSoloGender] = useState<TravelerGender>('');
    const [soloAge, setSoloAge] = useState('');
    const [soloComfort, setSoloComfort] = useState<'social' | 'balanced' | 'private'>('balanced');
    const [coupleTravelerA, setCoupleTravelerA] = useState<TravelerGender>('');
    const [coupleTravelerB, setCoupleTravelerB] = useState<TravelerGender>('');
    const [coupleOccasion, setCoupleOccasion] = useState<'none' | 'honeymoon' | 'anniversary' | 'city-break'>('none');
    const [friendsCount, setFriendsCount] = useState(4);
    const [friendsEnergy, setFriendsEnergy] = useState<'chill' | 'mixed' | 'full-send'>('mixed');
    const [familyAdults, setFamilyAdults] = useState(2);
    const [familyChildren, setFamilyChildren] = useState(1);
    const [familyBabies, setFamilyBabies] = useState(0);
    const [travelerSettingsOpen, setTravelerSettingsOpen] = useState(false);
    const [settingsTraveler, setSettingsTraveler] = useState<TravelerType>(DEFAULT_EFFECTIVE_TRAVELER);
    const [isDesktopSettings, setIsDesktopSettings] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.matchMedia('(min-width: 768px)').matches;
    });

    const [notes, setNotes] = useState('');
    const [prefillMeta, setPrefillMeta] = useState<TripPrefillData['meta'] | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [sectionExpanded, setSectionExpanded] = useState<Record<CollapsibleSection, boolean>>({
        traveler: false,
        style: false,
        transport: false,
    });
    const [mobileSnapshotExpanded, setMobileSnapshotExpanded] = useState(false);
    const [mobileSnapshotFooterOffset, setMobileSnapshotFooterOffset] = useState(0);

    const searchWrapperRef = useRef<HTMLDivElement | null>(null);
    const searchDropdownRef = useRef<HTMLDivElement | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchPosition, setSearchPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const snapshotRouteRef = useRef<HTMLDivElement | null>(null);
    const snapshotNodeRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [snapshotRouteGeometry, setSnapshotRouteGeometry] = useState<SnapshotRouteGeometry | null>(null);

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

    const getLocalizedIslandMeta = useCallback((destinationName: string): string | undefined => {
        const destination = getDestinationOptionByName(destinationName);
        if (!destination || destination.kind !== 'island' || !destination.parentCountryName) return undefined;
        const parentName = getLocalizedCountryName(destination.parentCountryCode, destination.parentCountryName);
        return t('destination.islandOf', { country: parentName });
    }, [getLocalizedCountryName, t]);

    const suggestions = useMemo(() => {
        const source = searchDestinationOptions('', {
            excludeNames: destinations,
            limit: DESTINATION_OPTIONS.length,
        });
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) return source.slice(0, 30);

        const startsWithMatches: typeof source = [];
        const includesMatches: typeof source = [];

        source.forEach((option) => {
            const localizedName = option.kind === 'country'
                ? getLocalizedCountryName(option.code, option.name)
                : option.name;
            const localizedParent = option.parentCountryCode
                ? getLocalizedCountryName(option.parentCountryCode, option.parentCountryName || '')
                : option.parentCountryName || '';
            const startsWith = [option.name, localizedName, ...(option.aliases || [])]
                .filter(Boolean)
                .some((value) => value.toLocaleLowerCase().startsWith(normalizedQuery));

            if (startsWith) {
                startsWithMatches.push(option);
                return;
            }

            const haystack = [
                option.name,
                localizedName,
                option.parentCountryName,
                localizedParent,
                ...(option.aliases || []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLocaleLowerCase();

            if (haystack.includes(normalizedQuery)) {
                includesMatches.push(option);
            }
        });

        return [...startsWithMatches, ...includesMatches].slice(0, 30);
    }, [destinations, getLocalizedCountryName, query]);

    const orderedDestinations = useMemo(() => {
        if (destinations.length === 0) return [];
        const effectiveStart = startDestination && destinations.includes(startDestination) ? startDestination : destinations[0];
        const startIndex = destinations.indexOf(effectiveStart);
        if (startIndex <= 0) return destinations;
        return [...destinations.slice(startIndex), ...destinations.slice(0, startIndex)];
    }, [destinations, startDestination]);

    const routeHeadline = useMemo(() => {
        const labels = orderedDestinations.map((destination) => getLocalizedDestinationLabel(destination));
        if (!routeLock) return formatDestinationList(labels);
        if (!roundTrip || labels.length === 0) return labels.join(' → ');
        return [...labels, labels[0]].join(' → ');
    }, [getLocalizedDestinationLabel, orderedDestinations, routeLock, roundTrip]);

    const dayCount = useMemo(() => {
        if (dateInputMode === 'flex') return Math.max(7, flexWeeks * 7);
        return getDaysDifference(startDate, endDate);
    }, [dateInputMode, endDate, flexWeeks, startDate]);

    const mobileDateRangeLabel = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return t('dates.summary', { days: dayCount });
        }
        const formatter = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' });
        return `${formatter.format(start)} - ${formatter.format(end)}`;
    }, [dayCount, endDate, i18n.language, startDate, t]);

    const averageDaysPerStop = useMemo(() => {
        if (orderedDestinations.length === 0) return 0;
        return dayCount / orderedDestinations.length;
    }, [dayCount, orderedDestinations.length]);

    const destinationComplete = orderedDestinations.length > 0;
    const datesComplete = Boolean(startDate && endDate);
    const canLockRoute = destinations.length > 1;

    const travelerSummary = t(`traveler.options.${travelerType}`);
    const styleSummary = selectedStyles
        .map((styleId) => STYLE_CHOICES.find((entry) => entry.id === styleId))
        .filter((entry): entry is ChoiceOption<string> => Boolean(entry))
        .map((entry) => t(entry.labelKey))
        .join(', ');
    const transportSummary = transportModes
        .map((mode) => TRANSPORT_OPTIONS.find((entry) => entry.id === mode))
        .filter((entry): entry is ChoiceOption<TransportMode> => Boolean(entry))
        .map((entry) => t(entry.labelKey))
        .join(', ');

    const travelerDetailSummary = useMemo(() => {
        if (travelerType === 'solo') {
            const chunks: string[] = [];
            if (soloGender) chunks.push(soloGender.replace('-', ' '));
            if (soloAge) chunks.push(`${soloAge}y`);
            chunks.push(soloComfort);
            return chunks.join(' • ');
        }

        if (travelerType === 'couple') {
            const chunks: string[] = [];
            if (coupleTravelerA && coupleTravelerB) {
                chunks.push(`${coupleTravelerA.replace('-', ' ')} + ${coupleTravelerB.replace('-', ' ')}`);
            }
            if (coupleOccasion !== 'none') chunks.push(coupleOccasion.replace('-', ' '));
            return chunks.length > 0 ? chunks.join(' • ') : t('traveler.settings.summaryHint');
        }

        if (travelerType === 'friends') {
            return `${friendsCount} • ${friendsEnergy.replace('-', ' ')}`;
        }

        return `${familyAdults}A • ${familyChildren}C • ${familyBabies}B`;
    }, [coupleOccasion, coupleTravelerA, coupleTravelerB, familyAdults, familyBabies, familyChildren, friendsCount, friendsEnergy, soloAge, soloComfort, soloGender, travelerType]);

    const transportMismatch = hasTransportOverride && !(transportModes.length === 1 && transportModes[0] === 'auto');

    const routeTimelineDestinations = orderedDestinations;
    const routeHasMultipleStops = routeTimelineDestinations.length > 1;
    const routeLoopSegmentWidth = snapshotRouteGeometry ? Math.max(snapshotRouteGeometry.axisX - snapshotRouteGeometry.loopLeft, 12) : 0;
    const routeLoopSegmentHeight = snapshotRouteGeometry ? Math.max(snapshotRouteGeometry.lastY - snapshotRouteGeometry.firstY, 10) : 0;
    const showLockedRouteLines = Boolean(snapshotRouteGeometry && routeLock && routeHasMultipleStops);

    const updateSearchPosition = useCallback(() => {
        if (!searchWrapperRef.current) return;
        const rect = searchWrapperRef.current.getBoundingClientRect();
        const width = Math.max(280, Math.min(rect.width, window.innerWidth - 16));
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setSearchPosition({
            top: rect.bottom + 8,
            left,
            width,
        });
    }, []);

    const openSearch = useCallback(() => {
        updateSearchPosition();
        setSearchOpen(true);
    }, [updateSearchPosition]);

    const updateSnapshotRouteGeometry = useCallback(() => {
        const container = snapshotRouteRef.current;
        if (!container) {
            setSnapshotRouteGeometry(null);
            return;
        }

        const nodes = snapshotNodeRefs.current.filter((node): node is HTMLDivElement => Boolean(node));
        if (nodes.length === 0) {
            setSnapshotRouteGeometry(null);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const points = nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return {
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top + rect.height / 2,
            };
        });

        const axisX = points.reduce((total, point) => total + point.x, 0) / points.length;
        const firstY = points[0].y;
        const lastY = points[points.length - 1].y;
        const loopLeft = Math.max(6, axisX - 28);
        const segmentMidpoints = points.slice(0, -1).map((point, index) => (point.y + points[index + 1].y) / 2);

        setSnapshotRouteGeometry((previous) => {
            if (!previous) return { axisX, firstY, lastY, loopLeft, segmentMidpoints };
            const sameMidpoints =
                previous.segmentMidpoints.length === segmentMidpoints.length &&
                previous.segmentMidpoints.every((value, index) => Math.abs(value - segmentMidpoints[index]) < 0.5);
            const unchanged =
                Math.abs(previous.axisX - axisX) < 0.5 &&
                Math.abs(previous.firstY - firstY) < 0.5 &&
                Math.abs(previous.lastY - lastY) < 0.5 &&
                Math.abs(previous.loopLeft - loopLeft) < 0.5 &&
                sameMidpoints;
            return unchanged ? previous : { axisX, firstY, lastY, loopLeft, segmentMidpoints };
        });
    }, []);

    useEffect(() => {
        if (!canLockRoute) {
            setRouteLock(false);
            setDragIndex(null);
            setDragOverIndex(null);
        }
    }, [canLockRoute]);

    useEffect(() => {
        const updateMobileSnapshotOffset = () => {
            const footer = document.querySelector('footer');
            if (!footer) {
                setMobileSnapshotFooterOffset(0);
                return;
            }
            const rect = footer.getBoundingClientRect();
            const overlap = Math.max(0, window.innerHeight - rect.top);
            setMobileSnapshotFooterOffset((previous) => (Math.abs(previous - overlap) < 0.5 ? previous : overlap));
        };

        updateMobileSnapshotOffset();
        window.addEventListener('resize', updateMobileSnapshotOffset);
        window.addEventListener('scroll', updateMobileSnapshotOffset, true);
        return () => {
            window.removeEventListener('resize', updateMobileSnapshotOffset);
            window.removeEventListener('scroll', updateMobileSnapshotOffset, true);
        };
    }, []);

    useEffect(() => {
        if (destinations.length === 0) {
            setStartDestination('');
            return;
        }

        if (!startDestination || !destinations.includes(startDestination)) {
            setStartDestination(destinations[0]);
        }
    }, [destinations, startDestination]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const onChange = () => setIsDesktopSettings(mediaQuery.matches);
        onChange();

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', onChange);
            return () => mediaQuery.removeEventListener('change', onChange);
        }

        mediaQuery.addListener(onChange);
        return () => mediaQuery.removeListener(onChange);
    }, []);

    useEffect(() => {
        const raw = searchParams.get('prefill');
        if (!raw) return;
        const data = decodeTripPrefill(raw);
        if (!data) return;

        if (data.countries && data.countries.length > 0) {
            setDestinations(data.countries);
            setStartDestination(data.countries[0]);
        }
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.budget) setBudget(data.budget as BudgetType);
        if (data.pace) setPace(data.pace as PaceType);
        if (typeof data.roundTrip === 'boolean') setRoundTrip(data.roundTrip);
        if (data.notes) setNotes(data.notes);
        if (Array.isArray(data.styles) && data.styles.length > 0) setSelectedStyles(data.styles);
        if (data.meta) setPrefillMeta(data.meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
        if (!searchOpen) return;
        updateSearchPosition();
    }, [destinations.length, query, searchOpen, updateSearchPosition]);

    useEffect(() => {
        if (!searchOpen) return;
        const onPositionChange = () => updateSearchPosition();
        window.addEventListener('resize', onPositionChange);
        window.addEventListener('scroll', onPositionChange, true);
        return () => {
            window.removeEventListener('resize', onPositionChange);
            window.removeEventListener('scroll', onPositionChange, true);
        };
    }, [searchOpen, updateSearchPosition]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            const inWrapper = searchWrapperRef.current?.contains(target);
            const inDropdown = searchDropdownRef.current?.contains(target);
            if (!inWrapper && !inDropdown) {
                setSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    useEffect(() => {
        snapshotNodeRefs.current = snapshotNodeRefs.current.slice(0, routeTimelineDestinations.length);
    }, [routeTimelineDestinations.length]);

    useLayoutEffect(() => {
        updateSnapshotRouteGeometry();
    }, [routeTimelineDestinations, roundTrip, routeLock, updateSnapshotRouteGeometry]);

    useEffect(() => {
        window.addEventListener('resize', updateSnapshotRouteGeometry);
        return () => window.removeEventListener('resize', updateSnapshotRouteGeometry);
    }, [updateSnapshotRouteGeometry]);

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => updateSnapshotRouteGeometry());
        if (snapshotRouteRef.current) observer.observe(snapshotRouteRef.current);
        snapshotNodeRefs.current.forEach((node) => {
            if (node) observer.observe(node);
        });

        return () => observer.disconnect();
    }, [routeTimelineDestinations, updateSnapshotRouteGeometry]);

    const toggleSection = (section: CollapsibleSection) => {
        setSectionExpanded((previous) => {
            const nextExpanded = !previous[section];
            trackEvent('create_trip__section--expand', {
                section_id: section,
                expanded: nextExpanded,
            });
            return {
                ...previous,
                [section]: nextExpanded,
            };
        });
    };

    const addDestination = (rawValue: string) => {
        const normalized = resolveDestinationName(rawValue);
        if (!normalized) return;
        const alreadySelected = destinations.some((entry) => entry.toLocaleLowerCase() === normalized.toLocaleLowerCase());
        if (alreadySelected) return;

        setDestinations((previous) => [...previous, normalized]);
        setQuery('');
        setSearchOpen(false);
    };

    const removeDestination = (name: string) => {
        setDestinations((previous) => previous.filter((entry) => entry !== name));
    };

    const handleDestinationDragStart = (index: number) => {
        if (!routeLock) return;
        setDragIndex(index);
        setDragOverIndex(index);
    };

    const handleDestinationDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
        if (!routeLock || dragIndex === null) return;
        event.preventDefault();
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDestinationDrop = (index: number) => {
        if (!routeLock || dragIndex === null) return;
        if (dragIndex === index) {
            setDragIndex(null);
            setDragOverIndex(null);
            return;
        }

        setDestinations((previous) => {
            const next = [...previous];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(index, 0, moved);
            return next;
        });

        setDragIndex(null);
        setDragOverIndex(null);
    };

    const handleDestinationDragEnd = () => {
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const toggleStyle = (styleId: string) => {
        setSelectedStyles((previous) =>
            previous.includes(styleId)
                ? previous.filter((entry) => entry !== styleId)
                : [...previous, styleId]
        );
    };

    const toggleTransportMode = (mode: TransportMode) => {
        if (mode === 'camper') return;
        setHasTransportOverride(true);
        setTransportModes((previous) => {
            if (mode === 'auto') return ['auto'];

            const withoutAuto = previous.filter((entry) => entry !== 'auto');
            if (withoutAuto.includes(mode)) {
                const filtered = withoutAuto.filter((entry) => entry !== mode);
                return filtered.length > 0 ? filtered : ['auto'];
            }

            return [...withoutAuto, mode];
        });
    };

    const openTravelerSettings = (type: TravelerType) => {
        setTravelerType(type);
        setSettingsTraveler(type);
        setTravelerSettingsOpen(true);
    };

    const setSnapshotNodeRef = useCallback((index: number, node: HTMLDivElement | null) => {
        snapshotNodeRefs.current[index] = node;
    }, []);

    const settingsTravelerLabel = t(`traveler.options.${settingsTraveler}`);
    const isLgbtqCoupleMode = settingsTraveler === 'couple' && coupleTravelerA !== '' && coupleTravelerB !== '' && (
        coupleTravelerA === 'non-binary'
        || coupleTravelerB === 'non-binary'
        || (
            (coupleTravelerA === 'female' || coupleTravelerA === 'male')
            && coupleTravelerA === coupleTravelerB
        )
    );

    const settingsContent = (
        <div className="space-y-4">
            <div>
                <div className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">{t('traveler.settings.optionalDetails')}</div>
                <p className="mt-1 text-sm text-slate-600">{t('traveler.settings.helper')}</p>
            </div>

            {settingsTraveler === 'solo' && (
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.gender')}</label>
                            <select
                                value={soloGender}
                                onChange={(event) => setSoloGender(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">{t('traveler.settings.notSpecified')}</option>
                                <option value="female">{t('traveler.settings.genderFemale')}</option>
                                <option value="male">{t('traveler.settings.genderMale')}</option>
                                <option value="non-binary">{t('traveler.settings.genderNonBinary')}</option>
                                <option value="prefer-not">{t('traveler.settings.genderPreferNot')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.age')}</label>
                            <input
                                type="number"
                                min={18}
                                max={100}
                                value={soloAge}
                                onChange={(event) => setSoloAge(event.target.value)}
                                placeholder={t('traveler.settings.agePlaceholder')}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.comfortMode')}</label>
                        <div className="mt-1 grid gap-2 sm:grid-cols-3">
                            {(['social', 'balanced', 'private'] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setSoloComfort(value)}
                                    className={[
                                        'rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                                        soloComfort === value
                                            ? 'border-accent-300 bg-accent-50 text-accent-800'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                    ].join(' ')}
                                >
                                    {t(`traveler.settings.comfortOptions.${value}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {settingsTraveler === 'couple' && (
                <div className="space-y-3">
                    {isLgbtqCoupleMode && (
                        <div
                            aria-hidden="true"
                            className="h-1.5 rounded-full bg-[linear-gradient(90deg,#e11d48_0%,#f97316_18%,#eab308_36%,#22c55e_54%,#3b82f6_72%,#6366f1_86%,#a855f7_100%)]"
                        />
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.travelerA')}</label>
                            <select
                                value={coupleTravelerA}
                                onChange={(event) => setCoupleTravelerA(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">{t('traveler.settings.notSpecified')}</option>
                                <option value="female">{t('traveler.settings.genderFemale')}</option>
                                <option value="male">{t('traveler.settings.genderMale')}</option>
                                <option value="non-binary">{t('traveler.settings.genderNonBinary')}</option>
                                <option value="prefer-not">{t('traveler.settings.genderPreferNot')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.travelerB')}</label>
                            <select
                                value={coupleTravelerB}
                                onChange={(event) => setCoupleTravelerB(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">{t('traveler.settings.notSpecified')}</option>
                                <option value="female">{t('traveler.settings.genderFemale')}</option>
                                <option value="male">{t('traveler.settings.genderMale')}</option>
                                <option value="non-binary">{t('traveler.settings.genderNonBinary')}</option>
                                <option value="prefer-not">{t('traveler.settings.genderPreferNot')}</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.occasion')}</label>
                        <select
                            value={coupleOccasion}
                            onChange={(event) => setCoupleOccasion(event.target.value as 'none' | 'honeymoon' | 'anniversary' | 'city-break')}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                        >
                            <option value="none">{t('traveler.settings.occasionOptions.none')}</option>
                            <option value="honeymoon">{t('traveler.settings.occasionOptions.honeymoon')}</option>
                            <option value="anniversary">{t('traveler.settings.occasionOptions.anniversary')}</option>
                            <option value="city-break">{t('traveler.settings.occasionOptions.cityBreak')}</option>
                        </select>
                    </div>
                </div>
            )}

            {settingsTraveler === 'friends' && (
                <div className="space-y-3">
                    <NumberStepper label={t('traveler.settings.groupSize')} value={friendsCount} min={2} max={12} onChange={setFriendsCount} />
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{t('traveler.settings.groupEnergy')}</label>
                        <div className="mt-1 grid gap-2 sm:grid-cols-3">
                            {(['chill', 'mixed', 'full-send'] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFriendsEnergy(value)}
                                    className={[
                                        'rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                                        friendsEnergy === value
                                            ? 'border-accent-300 bg-accent-50 text-accent-800'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                    ].join(' ')}
                                >
                                    {t(`traveler.settings.energyOptions.${value}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {settingsTraveler === 'family' && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <NumberStepper label={t('traveler.settings.adults')} value={familyAdults} min={1} max={8} onChange={setFamilyAdults} />
                    <NumberStepper label={t('traveler.settings.children')} value={familyChildren} min={0} max={8} onChange={setFamilyChildren} />
                    <NumberStepper label={t('traveler.settings.babies')} value={familyBabies} min={0} max={4} onChange={setFamilyBabies} />
                </div>
            )}
        </div>
    );

    const settingsDialog = isDesktopSettings ? (
        <Dialog open={travelerSettingsOpen} onOpenChange={setTravelerSettingsOpen}>
            <DialogContent className="max-w-xl rounded-2xl p-5">
                <DialogHeader className="p-0">
                    <DialogTitle>{t('traveler.settings.title', { traveler: settingsTravelerLabel })}</DialogTitle>
                    <DialogDescription>{t('traveler.settings.description')}</DialogDescription>
                </DialogHeader>
                <div className="mt-4">{settingsContent}</div>
                <DialogFooter className="p-0 pt-4">
                    <button
                        type="button"
                        onClick={() => setTravelerSettingsOpen(false)}
                        className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                    >
                        {t('traveler.settings.done')}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    ) : (
        <Drawer open={travelerSettingsOpen} onOpenChange={setTravelerSettingsOpen}>
            <DrawerContent
                className="max-h-[90vh] rounded-t-2xl p-4"
                accessibleTitle={t('traveler.settings.title', { traveler: settingsTravelerLabel })}
                accessibleDescription={t('traveler.settings.optionalDetails')}
            >
                <DrawerHeader className="p-0">
                    <DrawerTitle>{t('traveler.settings.title', { traveler: settingsTravelerLabel })}</DrawerTitle>
                    <DrawerDescription>{t('traveler.settings.mobileDescription')}</DrawerDescription>
                </DrawerHeader>
                <div className="mt-4 max-h-[56vh] overflow-y-auto pr-1">{settingsContent}</div>
                <DrawerFooter className="p-0 pt-4">
                    <button
                        type="button"
                        onClick={() => setTravelerSettingsOpen(false)}
                        className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                    >
                        {t('traveler.settings.done')}
                    </button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );

    const handleRoundTripChange = (checked: boolean) => {
        setRoundTrip(checked);
        trackEvent('create_trip__toggle--roundtrip', { enabled: checked });
    };

    const handleRouteLockChange = (checked: boolean) => {
        if (!canLockRoute) return;
        setRouteLock(checked);
        trackEvent('create_trip__toggle--route_lock', { enabled: checked });
    };

    const handleGenerateTrip = async () => {
        if (isSubmitting) return;
        if (orderedDestinations.length === 0) {
            setSubmitError(t('errors.destinationRequired'));
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        trackEvent('create_trip__cta--generate', {
            destination_count: orderedDestinations.length,
            date_mode: dateInputMode,
            route_lock: routeLock,
            round_trip: roundTrip,
        });

        try {
            const destinationPrompt = orderedDestinations
                .map((destination) => getDestinationPromptLabel(destination))
                .join(', ');
            const notesInterests = notes
                .split(',')
                .map((token) => token.trim())
                .filter(Boolean);

            const generatedTrip = await generateItinerary(destinationPrompt, startDate, {
                budget,
                pace,
                interests: notesInterests.length > 0 ? notesInterests : undefined,
                roundTrip,
                totalDays: dayCount,
            });

            onTripGenerated(generatedTrip);
        } catch (error) {
            setSubmitError(getErrorMessage(error, t('errors.genericGenerate')));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff_0%,#f8fafc_50%,#ffffff_100%)] text-slate-900">
            <div className="pointer-events-none fixed inset-0 opacity-60">
                <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-accent-200/50 blur-3xl" />
                <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
            </div>

            <div className="relative z-10">
                <SiteHeader variant="glass" onMyTripsClick={onOpenManager} />

                <main className="mx-auto w-full max-w-[1260px] px-4 pb-28 pt-8 sm:px-6 sm:pb-32 lg:px-8 lg:pb-14">
                    {prefillMeta?.label && (
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-800">
                            <Sparkle size={13} weight="duotone" />
                            <span>{t('prefillBadge', { label: prefillMeta.label })}</span>
                        </div>
                    )}
                    {submitError && (
                        <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                            {submitError}
                        </div>
                    )}

                    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
                        <div className="space-y-5">
                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        <Compass size={18} weight="duotone" className="text-accent-600" />
                                        {t('destination.title')}
                                    </div>
                                    <CheckCircle
                                        size={20}
                                        weight="fill"
                                        className={destinationComplete ? 'text-emerald-500' : 'text-slate-300'}
                                        aria-hidden="true"
                                    />
                                </div>

                                <div className="relative" ref={searchWrapperRef}>
                                    <MagnifyingGlass
                                        size={18}
                                        weight="duotone"
                                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                    />
                                    <input
                                        value={query}
                                        onChange={(event) => {
                                            setQuery(event.target.value);
                                            openSearch();
                                        }}
                                        onFocus={openSearch}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                if (suggestions[0]) addDestination(suggestions[0].name);
                                            }
                                        }}
                                        placeholder={t('destination.searchPlaceholder')}
                                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm transition-shadow placeholder:text-slate-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200"
                                    />
                                </div>

                                {searchOpen && searchPosition && (query.trim() || suggestions.length > 0) && typeof document !== 'undefined' && createPortal(
                                    <div
                                        ref={searchDropdownRef}
                                        className="fixed z-[9999] max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
                                        style={{
                                            top: searchPosition.top,
                                            left: searchPosition.left,
                                            width: searchPosition.width,
                                        }}
                                    >
                                        {suggestions.length > 0 ? (
                                            suggestions.map((option) => {
                                                const optionLabel = option.kind === 'country'
                                                    ? getLocalizedCountryName(option.code, option.name)
                                                    : option.name;
                                                const islandMeta = option.kind === 'island' && option.parentCountryName
                                                    ? t('destination.islandOf', { country: getLocalizedCountryName(option.parentCountryCode, option.parentCountryName) })
                                                    : undefined;
                                                return (
                                                    <button
                                                        key={option.code}
                                                        type="button"
                                                        onClick={() => addDestination(option.name)}
                                                        className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-medium text-slate-800">
                                                                    {option.flag} {optionLabel}
                                                                </div>
                                                                {islandMeta && (
                                                                    <div className="mt-0.5 text-xs text-slate-500">
                                                                        {islandMeta}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <Plus size={14} className="mt-0.5 text-accent-500" />
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-6 text-center text-sm text-slate-400">{t('destination.noMatches')}</div>
                                        )}
                                    </div>,
                                    document.body
                                )}

                                {destinations.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {destinations.map((destination, index) => {
                                            const option = getDestinationOptionByName(destination);
                                            const dragActive = routeLock && dragOverIndex === index && dragIndex !== null;
                                            const isStartStop = destination === startDestination;
                                            const season = getCountrySeasonByName(getDestinationSeasonCountryName(destination));
                                            const metaLabel = getLocalizedIslandMeta(destination) || getDestinationMetaLabel(destination);
                                            const destinationLabel = getLocalizedDestinationLabel(destination);

                                            return (
                                                <span key={destination} className="group relative">
                                                    <div
                                                        draggable={routeLock}
                                                        onDragStart={() => handleDestinationDragStart(index)}
                                                        onDragOver={(event) => handleDestinationDragOver(event, index)}
                                                        onDrop={() => handleDestinationDrop(index)}
                                                        onDragEnd={handleDestinationDragEnd}
                                                        className={[
                                                            'inline-flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1 text-sm font-medium text-slate-800 shadow-sm',
                                                            isStartStop
                                                                ? 'border-accent-400 bg-accent-50 text-accent-900'
                                                                : 'border-slate-200',
                                                            routeLock ? 'cursor-grab active:cursor-grabbing' : '',
                                                            dragActive ? 'ring-2 ring-accent-200' : '',
                                                        ].join(' ')}
                                                    >
                                                        {routeLock && (
                                                            <span className="text-slate-400" aria-hidden="true">
                                                                <DotsSixVertical size={12} weight="duotone" />
                                                            </span>
                                                        )}
                                                        <span>{option?.flag || '🌍'}</span>
                                                        <span>{destinationLabel}</span>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setStartDestination(destination);
                                                            }}
                                                            className={[
                                                                'rounded-full transition-colors',
                                                                isStartStop ? 'text-accent-700' : 'text-slate-400 hover:text-accent-600',
                                                            ].join(' ')}
                                                            aria-label={t('destination.pinAsStart', { destination: destinationLabel })}
                                                            title={t('destination.pinAsStart', { destination: destinationLabel })}
                                                        >
                                                            <MapPin size={12} weight={isStartStop ? 'fill' : 'duotone'} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onMouseDown={(event) => event.stopPropagation()}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                removeDestination(destination);
                                                            }}
                                                            className="rounded-full text-slate-400 transition-colors hover:text-slate-700"
                                                            aria-label={t('destination.removeDestination', { destination: destinationLabel })}
                                                        >
                                                            <X size={12} weight="bold" />
                                                        </button>
                                                    </div>

                                                    {season && (
                                                        <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-[80] hidden w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                                                            <div className="text-xs font-semibold text-gray-900">{t('destination.idealTravelTime')}</div>
                                                            {metaLabel && <div className="mt-0.5 text-[11px] text-gray-500">{metaLabel}</div>}
                                                            <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                                                        </div>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <label className="inline-flex items-start gap-2 rounded-xl bg-transparent px-1.5 py-1.5 text-xs text-slate-700 sm:items-center sm:text-sm">
                                        <Switch
                                            checked={roundTrip}
                                            onCheckedChange={handleRoundTripChange}
                                            {...getAnalyticsDebugAttributes('create_trip__toggle--roundtrip', { enabled: roundTrip })}
                                        />
                                        <span>
                                            <span className="block text-[13px] font-semibold leading-tight text-slate-800 sm:text-sm">{t('destination.roundTrip.title')}</span>
                                            <span className="block text-[11px] leading-tight text-slate-500 sm:text-xs">{t('destination.roundTrip.description')}</span>
                                        </span>
                                    </label>

                                    <label className={['inline-flex items-start gap-2 rounded-xl bg-transparent px-1.5 py-1.5 text-xs text-slate-700 sm:items-center sm:text-sm', canLockRoute ? '' : 'opacity-50'].join(' ')}>
                                        <Switch
                                            checked={routeLock}
                                            onCheckedChange={handleRouteLockChange}
                                            disabled={!canLockRoute}
                                            {...getAnalyticsDebugAttributes('create_trip__toggle--route_lock', { enabled: routeLock })}
                                        />
                                        <span>
                                            <span className="block text-[13px] font-semibold leading-tight text-slate-800 sm:text-sm">{t('destination.routeLock.title')}</span>
                                            <span className="block text-[11px] leading-tight text-slate-500 sm:text-xs">{t('destination.routeLock.description')}</span>
                                        </span>
                                    </label>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        <CalendarBlank size={18} weight="duotone" className="text-accent-600" />
                                        {t('dates.title')}
                                    </div>
                                    <CheckCircle
                                        size={20}
                                        weight="fill"
                                        className={datesComplete ? 'text-emerald-500' : 'text-slate-300'}
                                        aria-hidden="true"
                                    />
                                </div>

                                <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-white p-1">
                                    <button
                                        type="button"
                                        onClick={() => setDateInputMode('exact')}
                                        className={[
                                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                            dateInputMode === 'exact' ? 'bg-accent-50 text-accent-800' : 'text-slate-600 hover:text-slate-800',
                                        ].join(' ')}
                                    >
                                        {t('dates.mode.exact')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDateInputMode('flex')}
                                        className={[
                                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                            dateInputMode === 'flex' ? 'bg-accent-50 text-accent-800' : 'text-slate-600 hover:text-slate-800',
                                        ].join(' ')}
                                    >
                                        {t('dates.mode.flex')}
                                    </button>
                                </div>

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
                                        labels={{
                                            start: t('dates.labels.start'),
                                            end: t('dates.labels.end'),
                                            selectDate: t('dates.labels.selectDate'),
                                            selectStartDate: t('dates.labels.selectStartDate'),
                                            selectEndDate: t('dates.labels.selectEndDate'),
                                            previousMonth: t('dates.labels.previousMonth'),
                                            nextMonth: t('dates.labels.nextMonth'),
                                        }}
                                    />
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="space-y-1.5 text-sm">
                                            <span className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('dates.flexWindow.weeksLabel')}</span>
                                            <div className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setFlexWeeks((previous) => clampNumber(previous - 1, 1, 8))}
                                                    disabled={flexWeeks <= 1}
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                    aria-label="Decrease weeks"
                                                >
                                                    <Minus size={13} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={8}
                                                    value={flexWeeks}
                                                    onChange={(event) => {
                                                        const value = Number(event.target.value);
                                                        const normalized = Number.isFinite(value) ? Math.min(8, Math.max(1, value)) : 1;
                                                        setFlexWeeks(normalized);
                                                    }}
                                                    className="h-7 w-10 rounded-md border-0 bg-transparent text-center text-sm font-semibold text-slate-800 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setFlexWeeks((previous) => clampNumber(previous + 1, 1, 8))}
                                                    disabled={flexWeeks >= 8}
                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                    aria-label="Increase weeks"
                                                >
                                                    <Plus size={13} />
                                                </button>
                                            </div>
                                        </label>
                                        <label className="space-y-1.5 text-sm">
                                            <span className="text-xs font-semibold uppercase tracking-[0.11em] text-slate-500">{t('dates.flexWindow.rangeLabel')}</span>
                                            <select
                                                value={flexWindow}
                                                onChange={(event) => setFlexWindow(event.target.value as FlexWindow)}
                                                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                            >
                                                {FLEX_WINDOW_OPTIONS.map((entry) => (
                                                    <option key={entry.id} value={entry.id}>{t(entry.labelKey)}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                )}

                                <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
                                    {t('dates.summary', { days: dayCount })}
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('traveler')}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                    {...getAnalyticsDebugAttributes('create_trip__section--expand', {
                                        section_id: 'traveler',
                                        expanded: sectionExpanded.traveler,
                                    })}
                                >
                                    <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <UsersThree size={18} weight="duotone" className="text-accent-600" />
                                            {t('traveler.title')}
                                        </div>
                                        <div className="truncate text-xs text-slate-500">{travelerSummary}</div>
                                    </div>
                                    {sectionExpanded.traveler ? <CaretUp size={16} className="text-slate-500" /> : <CaretDown size={16} className="text-slate-500" />}
                                </button>
                                {sectionExpanded.traveler && (
                                    <div className="mt-4">
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {TRAVELER_OPTIONS.map((entry) => {
                                                const Icon = entry.icon;
                                                const active = travelerType === entry.id;
                                                const summary = entry.id === travelerType ? travelerDetailSummary : t('traveler.settings.summaryHint');
                                                return (
                                                    <div
                                                        key={entry.id}
                                                        onClick={() => setTravelerType(entry.id)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter' || event.key === ' ') {
                                                                event.preventDefault();
                                                                setTravelerType(entry.id);
                                                            }
                                                        }}
                                                        role="button"
                                                        tabIndex={0}
                                                        className={[
                                                            'group relative rounded-xl border px-3 py-3 text-left transition-colors',
                                                            active
                                                                ? 'border-accent-400 bg-accent-50 text-accent-900'
                                                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                                                        ].join(' ')}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openTravelerSettings(entry.id);
                                                            }}
                                                            aria-label={t('traveler.settings.open', { traveler: t(entry.labelKey) })}
                                                            title={t('traveler.settings.open', { traveler: t(entry.labelKey) })}
                                                            className={[
                                                                'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
                                                                active
                                                                    ? 'border-accent-300 bg-white text-accent-700 opacity-100'
                                                                    : 'border-slate-200 bg-white text-slate-500 opacity-0 group-hover:opacity-100',
                                                            ].join(' ')}
                                                        >
                                                            <GearSix size={14} />
                                                        </button>
                                                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                                            <Icon size={17} weight="duotone" />
                                                            {t(entry.labelKey)}
                                                        </span>
                                                        <div className="mt-1 text-xs text-slate-500">{summary}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            {t('previewOnly.traveler')}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('style')}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                    {...getAnalyticsDebugAttributes('create_trip__section--expand', {
                                        section_id: 'style',
                                        expanded: sectionExpanded.style,
                                    })}
                                >
                                    <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <Sparkle size={18} weight="duotone" className="text-accent-600" />
                                            {t('style.title')}
                                        </div>
                                        <div className="truncate text-xs text-slate-500">{styleSummary || t('style.empty')}</div>
                                    </div>
                                    {sectionExpanded.style ? <CaretUp size={16} className="text-slate-500" /> : <CaretDown size={16} className="text-slate-500" />}
                                </button>
                                {sectionExpanded.style && (
                                    <div className="mt-4">
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                            {STYLE_CHOICES.map((entry) => {
                                                const Icon = entry.icon;
                                                const active = selectedStyles.includes(entry.id);
                                                return (
                                                    <button
                                                        key={entry.id}
                                                        type="button"
                                                        onClick={() => toggleStyle(entry.id)}
                                                        className={[
                                                            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                            active
                                                                ? 'border-accent-300 bg-accent-50 text-accent-900'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                        ].join(' ')}
                                                    >
                                                        <Icon size={15} weight="duotone" />
                                                        {t(entry.labelKey)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            {t('previewOnly.style')}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <button
                                    type="button"
                                    onClick={() => toggleSection('transport')}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                    {...getAnalyticsDebugAttributes('create_trip__section--expand', {
                                        section_id: 'transport',
                                        expanded: sectionExpanded.transport,
                                    })}
                                >
                                    <div className="min-w-0">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <Train size={18} weight="duotone" className="text-accent-600" />
                                            {t('transport.title')}
                                        </div>
                                        <div className="truncate text-xs text-slate-500">{transportSummary}</div>
                                    </div>
                                    {sectionExpanded.transport ? <CaretUp size={16} className="text-slate-500" /> : <CaretDown size={16} className="text-slate-500" />}
                                </button>
                                {sectionExpanded.transport && (
                                    <div className="mt-4">
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                            {TRANSPORT_OPTIONS.map((entry) => {
                                                const Icon = entry.icon;
                                                const active = transportModes.includes(entry.id);
                                                const disabled = entry.id === 'camper';
                                                return (
                                                    <button
                                                        key={entry.id}
                                                        type="button"
                                                        onClick={() => toggleTransportMode(entry.id)}
                                                        disabled={disabled}
                                                        className={[
                                                            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                            disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : '',
                                                            active
                                                                ? 'border-accent-300 bg-accent-50 text-accent-900'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                        ].join(' ')}
                                                    >
                                                        <Icon size={15} weight="duotone" />
                                                        {t(entry.labelKey)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-2 text-xs text-slate-500">{t('transport.camperDisabled')}</p>
                                        {transportMismatch && (
                                            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                <WarningCircle size={14} className="mt-0.5 shrink-0" />
                                                {t('transport.overrideHint')}
                                            </div>
                                        )}
                                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            {t('previewOnly.transport')}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                                <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Info size={16} weight="duotone" className="text-accent-600" />
                                    {t('notes.title')}
                                </div>
                                <p className="mb-2 text-xs text-slate-500">{t('notes.hint')}</p>
                                <textarea
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    rows={4}
                                    placeholder={t('notes.placeholder')}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                                />
                            </section>
                        </div>

                        <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
                            <div className="space-y-4 rounded-2xl border border-indigo-300/20 bg-gradient-to-b from-[#0d1330] via-[#090f26] to-[#060915] p-4 text-slate-100 shadow-2xl sm:p-5">
                                <div>
                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                        <Compass size={13} weight="duotone" />
                                        {t('snapshot.title')}
                                    </div>
                                    <h2 className="text-xl font-bold leading-tight text-white">{routeHeadline}</h2>
                                </div>

                                <div ref={snapshotRouteRef} className="relative rounded-xl border border-white/15 bg-white/5 p-3">
                                    {showLockedRouteLines && snapshotRouteGeometry && (
                                        <>
                                            <div
                                                className="pointer-events-none absolute w-[2px] rounded-full bg-indigo-300/80"
                                                style={{
                                                    left: snapshotRouteGeometry.axisX - 1,
                                                    top: snapshotRouteGeometry.firstY,
                                                    height: Math.max(snapshotRouteGeometry.lastY - snapshotRouteGeometry.firstY, 0),
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute h-0 w-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-indigo-300/85"
                                                style={{
                                                    left: snapshotRouteGeometry.axisX - 5,
                                                    top: snapshotRouteGeometry.lastY + 6,
                                                }}
                                            />
                                            {snapshotRouteGeometry.segmentMidpoints.map((midpoint, index) => (
                                                <div
                                                    key={`route-segment-arrow-${index}`}
                                                    className="pointer-events-none absolute h-0 w-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-indigo-300/95"
                                                    style={{
                                                        left: snapshotRouteGeometry.axisX - 4,
                                                        top: midpoint - 3,
                                                    }}
                                                />
                                            ))}
                                        </>
                                    )}

                                    {showLockedRouteLines && snapshotRouteGeometry && roundTrip && (
                                        <>
                                            <div
                                                className="pointer-events-none absolute rounded-l-2xl border-b-2 border-l-2 border-t-2 border-indigo-300/70"
                                                style={{
                                                    left: snapshotRouteGeometry.loopLeft,
                                                    top: snapshotRouteGeometry.firstY,
                                                    width: routeLoopSegmentWidth,
                                                    height: routeLoopSegmentHeight,
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute h-0 w-0 border-b-[4px] border-l-[6px] border-t-[4px] border-b-transparent border-t-transparent border-l-indigo-300/90"
                                                style={{
                                                    left: snapshotRouteGeometry.loopLeft + routeLoopSegmentWidth / 2 - 6,
                                                    top: snapshotRouteGeometry.firstY - 4,
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute h-0 w-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-indigo-300/90"
                                                style={{
                                                    left: snapshotRouteGeometry.loopLeft - 3,
                                                    top: snapshotRouteGeometry.firstY + routeLoopSegmentHeight / 2 - 6,
                                                }}
                                            />
                                            <div
                                                className="pointer-events-none absolute h-0 w-0 border-r-[6px] border-b-[4px] border-t-[4px] border-b-transparent border-t-transparent border-r-indigo-300/90"
                                                style={{
                                                    left: snapshotRouteGeometry.loopLeft + routeLoopSegmentWidth / 2 - 3,
                                                    top: snapshotRouteGeometry.lastY - 4,
                                                }}
                                            />
                                        </>
                                    )}

                                    <div className="relative">
                                        {routeTimelineDestinations.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-white/20 px-3 py-4 text-sm text-indigo-100/80">
                                                {t('snapshot.emptyDestinations')}
                                            </div>
                                        ) : (
                                            routeTimelineDestinations.map((destination, index) => {
                                                const option = getDestinationOptionByName(destination);
                                                const isFirst = index === 0;
                                                return (
                                                    <div key={`${destination}-${index}`} className="grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 pb-4 last:pb-0">
                                                        <div
                                                            ref={(node) => setSnapshotNodeRef(index, node)}
                                                            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-[#0f173b] text-sm shadow-lg shadow-black/20"
                                                        >
                                                            {option?.flag || '🌍'}
                                                        </div>
                                                        <div className="min-w-0 pt-0.5">
                                                            <div className="text-sm font-semibold text-indigo-50">{getLocalizedDestinationLabel(destination)}</div>
                                                            {isFirst && (
                                                                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                                                                    <MapPin size={12} weight="fill" />
                                                                    {roundTrip ? t('snapshot.startEnd') : t('snapshot.start')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <CalendarBlank size={15} weight="duotone" className="text-indigo-200" />
                                            {t('snapshot.days', { days: dayCount })}
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">
                                            {orderedDestinations.length > 0
                                                ? t('snapshot.avgPerStop', { days: averageDaysPerStop.toFixed(1) })
                                                : t('snapshot.addDestinations')}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <UsersThree size={15} weight="duotone" className="text-indigo-200" />
                                            {travelerSummary}
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{travelerDetailSummary}</div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <Train size={15} weight="duotone" className="text-indigo-200" />
                                            {t('snapshot.transport')}
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{transportSummary}</div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <Sparkle size={15} weight="duotone" className="text-indigo-200" />
                                            {t('snapshot.style')}
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{styleSummary || t('style.empty')}</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                                    <div className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.11em]">
                                        <WarningCircle size={12} weight="fill" />
                                        {t('previewOnly.title')}
                                    </div>
                                    <div className="mt-1 text-[11px] text-amber-100/90">{t('previewOnly.global')}</div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGenerateTrip}
                                    disabled={isSubmitting || !destinationComplete}
                                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    {...getAnalyticsDebugAttributes('create_trip__cta--generate', {
                                        destination_count: orderedDestinations.length,
                                        date_mode: dateInputMode,
                                    })}
                                >
                                    {isSubmitting ? t('cta.loading') : t('cta.label')}
                                </button>
                            </div>
                        </aside>
                    </section>
                </main>

                <div
                    className="fixed inset-x-0 z-40 border-t border-indigo-300/25 bg-gradient-to-b from-[#0d1330]/95 via-[#090f26]/95 to-[#060915]/95 px-3 pb-4 pt-4 text-slate-100 backdrop-blur lg:hidden"
                    style={{ bottom: `${mobileSnapshotFooterOffset}px` }}
                >
                    <div className="mx-auto max-w-[1260px]">
                        <div className="flex items-start gap-3.5">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-200/95">{t('snapshot.title')}</div>
                                <div className="truncate text-[16px] font-semibold leading-snug text-white">{routeHeadline}</div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-indigo-100">
                                        {mobileDateRangeLabel}
                                    </span>
                                    <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-indigo-100">
                                        {t('snapshot.days', { days: dayCount })}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleGenerateTrip}
                                disabled={isSubmitting || !destinationComplete}
                                className="rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                                {...getAnalyticsDebugAttributes('create_trip__cta--generate', {
                                    destination_count: orderedDestinations.length,
                                    date_mode: dateInputMode,
                                    source: 'mobile_footer',
                                })}
                            >
                                {isSubmitting ? t('cta.loading') : t('cta.label')}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMobileSnapshotExpanded((previous) => !previous)}
                            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-100/95"
                        >
                            {mobileSnapshotExpanded ? <CaretDown size={12} /> : <CaretUp size={12} />}
                            {mobileSnapshotExpanded ? t('mobileSnapshot.hideDetails') : t('mobileSnapshot.showDetails')}
                        </button>
                        {mobileSnapshotExpanded && (
                            <div className="mt-2.5 grid grid-cols-2 gap-3 rounded-xl border border-white/15 bg-white/5 p-3.5 text-xs text-indigo-100">
                                <div>
                                    <div className="font-semibold text-indigo-200">{t('mobileSnapshot.days')}</div>
                                    <div>{dayCount}</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-indigo-200">{t('mobileSnapshot.traveler')}</div>
                                    <div>{travelerSummary}</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-indigo-200">{t('mobileSnapshot.style')}</div>
                                    <div className="truncate">{styleSummary || t('style.empty')}</div>
                                </div>
                                <div>
                                    <div className="font-semibold text-indigo-200">{t('mobileSnapshot.transport')}</div>
                                    <div>{transportSummary}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {settingsDialog}

                <SiteFooter className="relative z-10 mt-6" />
            </div>
        </div>
    );
};
