import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
    AirplaneTilt,
    Bicycle,
    Buildings,
    Bus,
    CalendarBlank,
    CarProfile,
    Compass,
    DotsSixVertical,
    ForkKnife,
    GearSix,
    Info,
    Laptop,
    MagicWand,
    MapPin,
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
    UsersFour,
    UsersThree,
    Van,
    WarningCircle,
    X,
} from '@phosphor-icons/react';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { DateRangePicker } from '../components/DateRangePicker';
import { IdealTravelTimeline } from '../components/IdealTravelTimeline';
import { useDbSync } from '../hooks/useDbSync';
import { AppLanguage } from '../types';
import {
    buildCreateTripUrl,
    getDestinationMetaLabel,
    getDestinationOptionByName,
    getDestinationSeasonCountryName,
    resolveDestinationName,
    searchDestinationOptions,
} from '../utils';
import { getCountrySeasonByName } from '../data/countryTravelData';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '../components/ui/drawer';

interface CreateTripClassicLabPageProps {
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}

type TravelerType = 'solo' | 'couple' | 'friends' | 'family';
type BudgetType = 'Low' | 'Medium' | 'High' | 'Luxury';
type PaceType = 'Relaxed' | 'Balanced' | 'Fast';
type DateInputMode = 'exact' | 'flex';
type FlexWindow = 'spring' | 'summer' | 'autumn' | 'winter' | 'shoulder';
type TransportMode = 'auto' | 'plane' | 'car' | 'train' | 'bus' | 'cycle' | 'walk' | 'camper';
type TravelerGender = '' | 'female' | 'male' | 'non-binary' | 'prefer-not';
type SnapshotRouteGeometry = {
    axisX: number;
    firstY: number;
    lastY: number;
    loopLeft: number;
    segmentMidpoints: number[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const STYLE_CHOICES: Array<{ id: string; label: string; icon: React.ComponentType<any> }> = [
    { id: 'culture', label: 'Culture', icon: Buildings },
    { id: 'food', label: 'Food', icon: ForkKnife },
    { id: 'nature', label: 'Nature', icon: Mountains },
    { id: 'beaches', label: 'Beaches', icon: SunHorizon },
    { id: 'nightlife', label: 'Nightlife', icon: MoonStars },
    { id: 'remote-work', label: 'Remote work', icon: Laptop },
];

const TRANSPORT_OPTIONS: Array<{ id: TransportMode; label: string; icon: React.ComponentType<any> }> = [
    { id: 'auto', label: 'Automatic', icon: MagicWand },
    { id: 'plane', label: 'Plane', icon: AirplaneTilt },
    { id: 'car', label: 'Car', icon: CarProfile },
    { id: 'train', label: 'Train', icon: Train },
    { id: 'bus', label: 'Bus', icon: Bus },
    { id: 'cycle', label: 'Cycle', icon: Bicycle },
    { id: 'walk', label: 'Walk', icon: PersonSimpleWalk },
    { id: 'camper', label: 'Camper', icon: Van },
];

const TRAVELER_OPTIONS: Array<{
    id: TravelerType;
    label: string;
    subtitle: string;
    icon: React.ComponentType<any>;
}> = [
    { id: 'solo', label: 'Solo', subtitle: 'One traveler', icon: User },
    { id: 'couple', label: 'Couple', subtitle: 'Two travelers', icon: Users },
    { id: 'friends', label: 'Friends', subtitle: 'Group trip', icon: UsersThree },
    { id: 'family', label: 'Family', subtitle: 'Mixed ages', icon: UsersFour },
];

const FLEX_WINDOW_LABELS: Record<FlexWindow, string> = {
    spring: 'Spring window',
    summer: 'Summer window',
    autumn: 'Autumn window',
    winter: 'Winter window',
    shoulder: 'Shoulder season',
};

const DID_YOU_KNOW_FACTS = [
    'Trips with 2-4 nights per stop usually feel less rushed while still giving variety.',
    'Choosing traveler profile early helps itinerary suggestions better match daily energy.',
    'Transport preferences are easiest to tune after pace and budget are defined together.',
    'You can still edit transport, cities, and timing after generation, so start with a strong brief.',
    'Locking route order can improve first-draft itinerary consistency for multi-country trips.',
];

const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const getInitialDateRange = (): { startDate: string; endDate: string } => {
    const start = addDays(new Date(), 21);
    const end = addDays(start, 9);
    return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
    };
};

const getSuggestedTransportModes = (pace: PaceType, budget: BudgetType): TransportMode[] => {
    if (budget === 'Low') {
        if (pace === 'Relaxed') return ['bus', 'train', 'walk'];
        if (pace === 'Balanced') return ['bus', 'train'];
        return ['train', 'bus'];
    }

    if (budget === 'Medium') {
        if (pace === 'Relaxed') return ['train', 'bus', 'cycle'];
        if (pace === 'Balanced') return ['train', 'car'];
        return ['train', 'plane'];
    }

    if (budget === 'High') {
        if (pace === 'Relaxed') return ['train', 'car'];
        if (pace === 'Balanced') return ['train', 'car', 'plane'];
        return ['plane', 'train'];
    }

    if (pace === 'Relaxed') return ['car', 'plane'];
    if (pace === 'Balanced') return ['plane', 'train', 'car'];
    return ['plane', 'train'];
};

const areTransportModesEqual = (left: TransportMode[], right: TransportMode[]): boolean => {
    if (left.length !== right.length) return false;
    const leftSorted = [...left].sort();
    const rightSorted = [...right].sort();
    return leftSorted.every((mode, index) => mode === rightSorted[index]);
};

const clampNumber = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const formatDestinationList = (destinations: string[]): string => {
    if (destinations.length === 0) return 'Choose destinations';
    if (destinations.length === 1) return destinations[0];
    if (destinations.length === 2) return `${destinations[0]} & ${destinations[1]}`;
    return `${destinations.slice(0, -1).join(', ')} & ${destinations[destinations.length - 1]}`;
};

const NumberStepper: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (next: number) => void;
}> = ({ label, value, min, max, onChange }) => {
    return (
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
};

export const CreateTripClassicLabPage: React.FC<CreateTripClassicLabPageProps> = ({ onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);

    const initialRange = useMemo(() => getInitialDateRange(), []);

    const [query, setQuery] = useState('');
    const [destinations, setDestinations] = useState<string[]>(['Madeira', 'Portugal']);
    const [startDestination, setStartDestination] = useState<string>('Madeira');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const [dateInputMode, setDateInputMode] = useState<DateInputMode>('exact');
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);
    const [flexWeeks, setFlexWeeks] = useState(2);
    const [flexWindow, setFlexWindow] = useState<FlexWindow>('shoulder');

    const [travelerType, setTravelerType] = useState<TravelerType>('couple');
    const [pace, setPace] = useState<PaceType>('Balanced');
    const [budget, setBudget] = useState<BudgetType>('Medium');
    const [roundTrip, setRoundTrip] = useState(true);
    const [routeLock, setRouteLock] = useState(false);

    const [selectedStyles, setSelectedStyles] = useState<string[]>(['culture', 'food']);
    const [notes, setNotes] = useState('Boutique stays, easy hikes, sunset viewpoints, and local seafood.');

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
    const [settingsTraveler, setSettingsTraveler] = useState<TravelerType>('couple');
    const [isDesktopSettings, setIsDesktopSettings] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.matchMedia('(min-width: 768px)').matches;
    });

    const [transportModes, setTransportModes] = useState<TransportMode[]>(['auto']);
    const [hasTransportOverride, setHasTransportOverride] = useState(false);
    const [camperWeight, setCamperWeight] = useState('3.5');
    const [camperWeightUnit, setCamperWeightUnit] = useState<'t' | 'kg'>('t');

    const searchWrapperRef = useRef<HTMLDivElement | null>(null);
    const searchDropdownRef = useRef<HTMLDivElement | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchPosition, setSearchPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const snapshotRouteRef = useRef<HTMLDivElement | null>(null);
    const snapshotNodeRefs = useRef<Array<HTMLDivElement | null>>([]);
    const [snapshotRouteGeometry, setSnapshotRouteGeometry] = useState<SnapshotRouteGeometry | null>(null);

    const suggestions = useMemo(
        () => searchDestinationOptions(query, { excludeNames: destinations, limit: 30 }),
        [query, destinations]
    );

    const updateSearchPosition = useCallback(() => {
        if (!searchWrapperRef.current) return;
        const rect = searchWrapperRef.current.getBoundingClientRect();
        const width = Math.max(260, Math.min(rect.width, window.innerWidth - 16));
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

    const dayCount = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const diff = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
        return Number.isFinite(diff) ? Math.max(diff, 1) : 1;
    }, [startDate, endDate]);

    const canLockRoute = destinations.length > 1;

    useEffect(() => {
        if (!canLockRoute) {
            setRouteLock(false);
            setDragIndex(null);
            setDragOverIndex(null);
        }
    }, [canLockRoute]);

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
        const handleChange = () => setIsDesktopSettings(mediaQuery.matches);

        handleChange();

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    useLayoutEffect(() => {
        if (!searchOpen) return;
        updateSearchPosition();
    }, [destinations.length, query, searchOpen, updateSearchPosition]);

    useEffect(() => {
        if (!searchOpen) return;
        const handlePositionChange = () => updateSearchPosition();
        window.addEventListener('resize', handlePositionChange);
        window.addEventListener('scroll', handlePositionChange, true);
        return () => {
            window.removeEventListener('resize', handlePositionChange);
            window.removeEventListener('scroll', handlePositionChange, true);
        };
    }, [searchOpen, updateSearchPosition]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const insideWrapper = searchWrapperRef.current?.contains(target);
            const insideDropdown = searchDropdownRef.current?.contains(target);
            if (!insideWrapper && !insideDropdown) {
                setSearchOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const profileIsDefault = pace === 'Balanced' && budget === 'Medium';
    const suggestedTransportModes = useMemo(() => getSuggestedTransportModes(pace, budget), [pace, budget]);

    useEffect(() => {
        if (profileIsDefault) {
            setTransportModes(['auto']);
            setHasTransportOverride(false);
            return;
        }

        setTransportModes(suggestedTransportModes);
        setHasTransportOverride(false);
    }, [profileIsDefault, suggestedTransportModes]);

    const baselineTransportModes = profileIsDefault ? (['auto'] as TransportMode[]) : suggestedTransportModes;
    const transportMismatch = hasTransportOverride && !areTransportModesEqual(transportModes, baselineTransportModes);
    const isVanlifeOnly = transportModes.length === 1 && transportModes[0] === 'camper';

    const transportSummary = transportModes
        .map((mode) => TRANSPORT_OPTIONS.find((entry) => entry.id === mode)?.label || mode)
        .join(', ');

    const travelerLabel = TRAVELER_OPTIONS.find((entry) => entry.id === travelerType)?.label || 'Traveler';

    const travelerDetailSummary = useMemo(() => {
        if (travelerType === 'solo') {
            const chunks: string[] = [];
            if (soloGender) chunks.push(soloGender.replace('-', ' '));
            if (soloAge) chunks.push(`${soloAge} years`);
            chunks.push(`${soloComfort} comfort`);
            return chunks.join(' • ');
        }

        if (travelerType === 'couple') {
            const chunks: string[] = [];
            if (coupleTravelerA && coupleTravelerB) {
                chunks.push(`${coupleTravelerA.replace('-', ' ')} + ${coupleTravelerB.replace('-', ' ')}`);
            }
            if (coupleOccasion !== 'none') chunks.push(coupleOccasion.replace('-', ' '));
            return chunks.length > 0 ? chunks.join(' • ') : 'Pair settings optional';
        }

        if (travelerType === 'friends') {
            return `${friendsCount} friends • ${friendsEnergy.replace('-', ' ')}`;
        }

        return `${familyAdults} adults • ${familyChildren} children • ${familyBabies} babies`;
    }, [coupleOccasion, coupleTravelerA, coupleTravelerB, familyAdults, familyBabies, familyChildren, friendsCount, friendsEnergy, soloAge, soloComfort, soloGender, travelerType]);

    const compiledNotes = useMemo(() => {
        const styleLabels = STYLE_CHOICES
            .filter((style) => selectedStyles.includes(style.id))
            .map((style) => style.label)
            .join(', ');

        const chunks = [notes.trim()];

        if (styleLabels) chunks.push(`Trip style: ${styleLabels}.`);
        if (travelerDetailSummary) chunks.push(`Traveler setup: ${travelerLabel} (${travelerDetailSummary}).`);
        if (transportSummary) chunks.push(`Transport preferences: ${transportSummary}.`);
        if (transportModes.includes('camper')) {
            chunks.push(`Camper weight: ${camperWeight || 'n/a'} ${camperWeightUnit}.`);
        }
        if (dateInputMode === 'flex') {
            chunks.push(`Date mode: flexible (${flexWeeks} week${flexWeeks === 1 ? '' : 's'}, ${FLEX_WINDOW_LABELS[flexWindow]}).`);
        }
        if (routeLock) chunks.push('Route lock enabled: keep destination order.');

        return chunks.filter(Boolean).join(' ');
    }, [camperWeight, camperWeightUnit, dateInputMode, flexWeeks, flexWindow, notes, routeLock, selectedStyles, transportModes, transportSummary, travelerDetailSummary, travelerLabel]);

    const daysUntilStart = useMemo(() => {
        const today = new Date();
        const start = new Date(`${startDate}T00:00:00`);
        return Math.max(0, Math.ceil((start.getTime() - today.getTime()) / DAY_MS));
    }, [startDate]);

    const averageDaysPerStop = useMemo(() => {
        if (destinations.length === 0) return 0;
        return dayCount / destinations.length;
    }, [dayCount, destinations.length]);

    const orderedDestinations = useMemo(() => {
        if (destinations.length === 0) return destinations;
        const effectiveStart = startDestination && destinations.includes(startDestination) ? startDestination : destinations[0];
        const startIndex = destinations.indexOf(effectiveStart);
        if (startIndex <= 0) return destinations;
        return [...destinations.slice(startIndex), ...destinations.slice(0, startIndex)];
    }, [destinations, startDestination]);

    const routeTimelineDestinations = orderedDestinations;
    const routeHeadlineDestinations = useMemo(() => {
        if (!routeLock) return orderedDestinations;
        if (!roundTrip || orderedDestinations.length === 0) return orderedDestinations;
        return [...orderedDestinations, orderedDestinations[0]];
    }, [orderedDestinations, routeLock, roundTrip]);

    const routeHeadline = useMemo(() => {
        if (routeLock) {
            return routeHeadlineDestinations.length > 0 ? routeHeadlineDestinations.join(' → ') : 'Choose destinations';
        }
        return formatDestinationList(orderedDestinations);
    }, [orderedDestinations, routeHeadlineDestinations, routeLock]);

    const routeHasMultipleStops = routeTimelineDestinations.length > 1;
    const routeLoopSegmentWidth = snapshotRouteGeometry ? Math.max(snapshotRouteGeometry.axisX - snapshotRouteGeometry.loopLeft, 12) : 0;
    const routeLoopSegmentHeight = snapshotRouteGeometry ? Math.max(snapshotRouteGeometry.lastY - snapshotRouteGeometry.firstY, 10) : 0;
    const showLockedRouteLines = Boolean(snapshotRouteGeometry && routeLock && routeHasMultipleStops);

    const prefillUrl = useMemo(
        () =>
            buildCreateTripUrl({
                mode: 'classic',
                countries: orderedDestinations,
                startDate,
                endDate,
                budget,
                pace,
                roundTrip,
                notes: compiledNotes,
                meta: {
                    source: 'create-trip-labs',
                    label: 'Classic Card Overhaul',
                },
            }),
        [budget, compiledNotes, endDate, orderedDestinations, pace, roundTrip, startDate]
    );

    const dynamicFact = useMemo(() => {
        const seed = new Date().getUTCDate() + destinations.length * 3 + selectedStyles.length * 5 + dayCount;
        return DID_YOU_KNOW_FACTS[seed % DID_YOU_KNOW_FACTS.length];
    }, [dayCount, destinations.length, selectedStyles.length]);

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

    const setSnapshotNodeRef = useCallback((index: number, node: HTMLDivElement | null) => {
        snapshotNodeRefs.current[index] = node;
    }, []);

    const addDestination = (rawValue: string) => {
        const normalized = resolveDestinationName(rawValue);
        if (!normalized) return;
        const alreadySelected = destinations.some((name) => name.toLocaleLowerCase() === normalized.toLocaleLowerCase());
        if (alreadySelected) return;
        setDestinations((previous) => [...previous, normalized]);
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
            previous.includes(styleId) ? previous.filter((entry) => entry !== styleId) : [...previous, styleId]
        );
    };

    const toggleTransportMode = (mode: TransportMode) => {
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

    const settingsTravelerLabel = TRAVELER_OPTIONS.find((entry) => entry.id === settingsTraveler)?.label || 'Traveler';

    const prideBorderEnabled =
        settingsTraveler === 'couple' &&
        ((coupleTravelerA === 'female' && coupleTravelerB === 'female') || (coupleTravelerA === 'male' && coupleTravelerB === 'male'));

    const settingsModalStyle: React.CSSProperties | undefined = prideBorderEnabled
        ? {
              border: '8px solid transparent',
              background:
                  'linear-gradient(#ffffff,#ffffff) padding-box, repeating-linear-gradient(180deg, #e40303 0 16%, #ff8c00 16% 32%, #ffed00 32% 48%, #008026 48% 64%, #24408e 64% 80%, #732982 80% 100%) border-box',
          }
        : undefined;

    const settingsContent = (
        <div className="space-y-4">
            <div>
                <div className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">Optional details</div>
                <p className="mt-1 text-sm text-slate-600">
                    These inputs are optional and only improve how trip suggestions are tailored.
                </p>
            </div>

            {settingsTraveler === 'solo' && (
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Gender (optional)</label>
                            <select
                                value={soloGender}
                                onChange={(event) => setSoloGender(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">Prefer not to say</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="non-binary">Non-binary</option>
                                <option value="prefer-not">Prefer not to say</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Age (optional)</label>
                            <input
                                type="number"
                                min={18}
                                max={100}
                                value={soloAge}
                                onChange={(event) => setSoloAge(event.target.value)}
                                placeholder="e.g. 31"
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Comfort mode</label>
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
                                    {value}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {settingsTraveler === 'couple' && (
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Traveler A (optional)</label>
                            <select
                                value={coupleTravelerA}
                                onChange={(event) => setCoupleTravelerA(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">Not specified</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="non-binary">Non-binary</option>
                                <option value="prefer-not">Prefer not to say</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Traveler B (optional)</label>
                            <select
                                value={coupleTravelerB}
                                onChange={(event) => setCoupleTravelerB(event.target.value as TravelerGender)}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                            >
                                <option value="">Not specified</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="non-binary">Non-binary</option>
                                <option value="prefer-not">Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Occasion (optional)</label>
                        <select
                            value={coupleOccasion}
                            onChange={(event) => setCoupleOccasion(event.target.value as 'none' | 'honeymoon' | 'anniversary' | 'city-break')}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                        >
                            <option value="none">No special occasion</option>
                            <option value="honeymoon">Honeymoon</option>
                            <option value="anniversary">Anniversary</option>
                            <option value="city-break">City break</option>
                        </select>
                    </div>
                </div>
            )}

            {settingsTraveler === 'friends' && (
                <div className="space-y-3">
                    <NumberStepper label="Group size" value={friendsCount} min={2} max={12} onChange={setFriendsCount} />
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Group energy</label>
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
                                    {value}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {settingsTraveler === 'family' && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <NumberStepper label="Adults" value={familyAdults} min={1} max={8} onChange={setFamilyAdults} />
                    <NumberStepper label="Children" value={familyChildren} min={0} max={8} onChange={setFamilyChildren} />
                    <NumberStepper label="Babies" value={familyBabies} min={0} max={4} onChange={setFamilyBabies} />
                </div>
            )}
        </div>
    );

    const settingsDialog = isDesktopSettings ? (
        <Dialog open={travelerSettingsOpen} onOpenChange={setTravelerSettingsOpen}>
            <DialogContent className="max-w-xl rounded-2xl p-5" style={settingsModalStyle}>
                <DialogHeader className="p-0">
                    <DialogTitle>Customize {settingsTravelerLabel} preferences</DialogTitle>
                    <DialogDescription>
                        Add optional details to refine generated suggestions for this traveler setup.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">{settingsContent}</div>
                <DialogFooter className="p-0 pt-4">
                    <button
                        type="button"
                        onClick={() => setTravelerSettingsOpen(false)}
                        className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                    >
                        Done
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    ) : (
        <Drawer open={travelerSettingsOpen} onOpenChange={setTravelerSettingsOpen}>
            <DrawerContent
                className="max-h-[90vh] rounded-t-2xl p-4"
                accessibleTitle={`Customize ${settingsTravelerLabel} preferences`}
                accessibleDescription="Optional traveler details"
                style={settingsModalStyle}
            >
                <DrawerHeader className="p-0">
                    <DrawerTitle>Customize {settingsTravelerLabel} preferences</DrawerTitle>
                    <DrawerDescription>
                        Optional details to improve planning relevance.
                    </DrawerDescription>
                </DrawerHeader>
                <div className="mt-4 max-h-[56vh] overflow-y-auto pr-1">{settingsContent}</div>
                <DrawerFooter className="p-0 pt-4">
                    <button
                        type="button"
                        onClick={() => setTravelerSettingsOpen(false)}
                        className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
                    >
                        Done
                    </button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef2ff_0%,#f8fafc_50%,#ffffff_100%)] text-slate-900">
            <div className="pointer-events-none fixed inset-0 opacity-60">
                <div className="absolute -left-16 top-12 h-56 w-56 rounded-full bg-accent-200/50 blur-3xl" />
                <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
            </div>

            <div className="relative z-10">
                <SiteHeader variant="glass" hideCreateTrip onMyTripsClick={onOpenManager} />

                <main className="mx-auto w-full max-w-[1380px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-700">
                                <Sparkle size={14} weight="duotone" />
                                Lab Concept 1
                            </div>
                            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">Classic Card Overhaul</h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                                More open layout with tighter sections, smarter setup controls, and a sticky snapshot for quick orientation.
                            </p>
                        </div>
                        <Link
                            to="/create-trip"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-700"
                        >
                            Back to current create-trip
                        </Link>
                    </div>

                    <section className="animate-content-fade-in grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
                        <div className="space-y-5">
                            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Compass size={17} weight="duotone" className="text-accent-600" />
                                    Destinations
                                </div>

                                <div className="mb-3 flex flex-wrap gap-2">
                                    {destinations.map((destination, index) => {
                                        const option = getDestinationOptionByName(destination);
                                        const dragActive = routeLock && dragOverIndex === index && dragIndex !== null;
                                        const isStartStop = destination === startDestination;
                                        const setStartTooltip = roundTrip
                                            ? `Set ${destination} as start and end location`
                                            : `Set ${destination} as start location`;
                                        const season = getCountrySeasonByName(getDestinationSeasonCountryName(destination));
                                        const metaLabel = getDestinationMetaLabel(destination);

                                        return (
                                            <span key={destination} className="group relative">
                                                <div
                                                    draggable={routeLock}
                                                    onDragStart={() => handleDestinationDragStart(index)}
                                                    onDragOver={(event) => handleDestinationDragOver(event, index)}
                                                    onDrop={() => handleDestinationDrop(index)}
                                                    onDragEnd={handleDestinationDragEnd}
                                                    className={[
                                                        'inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm font-medium',
                                                        isStartStop
                                                            ? 'border-accent-500 bg-accent-50 text-accent-900 shadow-[0_0_0_1px_rgba(37,99,235,0.08)]'
                                                            : 'border-accent-200 text-slate-700',
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
                                                    <span>{destination}</span>
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
                                                        aria-label={setStartTooltip}
                                                        title={setStartTooltip}
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
                                                        aria-label={`Remove ${destination}`}
                                                    >
                                                        <X size={12} weight="bold" />
                                                    </button>
                                                </div>

                                                {season && (
                                                    <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-[80] hidden w-[280px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl group-hover:block">
                                                        <div className="text-xs font-semibold text-gray-900">Ideal travel time</div>
                                                        {metaLabel && <div className="mt-0.5 text-[11px] text-gray-500">{metaLabel}</div>}
                                                        <IdealTravelTimeline idealMonths={season.bestMonths} shoulderMonths={season.shoulderMonths} />
                                                    </div>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="relative" ref={searchWrapperRef}>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-inner">
                                        <div className="flex items-center gap-2">
                                            <Compass size={16} className="text-accent-500" />
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
                                                        if (suggestions[0]) {
                                                            addDestination(suggestions[0].name);
                                                            setQuery('');
                                                        }
                                                    }
                                                }}
                                                placeholder="Search country or island"
                                                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {searchOpen && searchPosition && (query.trim() || suggestions.length > 0) && typeof document !== 'undefined' && createPortal(
                                    <div
                                        ref={searchDropdownRef}
                                        className="fixed z-[9999] max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
                                        style={{
                                            top: searchPosition.top,
                                            left: searchPosition.left,
                                            width: searchPosition.width,
                                        }}
                                    >
                                        {suggestions.length > 0 ? (
                                            suggestions.map((option) => (
                                                <button
                                                    key={option.code}
                                                    type="button"
                                                    onClick={() => {
                                                        addDestination(option.name);
                                                        setQuery('');
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-medium text-slate-800">
                                                                {option.flag} {option.name}
                                                            </div>
                                                            {option.kind === 'island' && option.parentCountryName && (
                                                                <div className="mt-0.5 text-xs text-slate-500">
                                                                    Island of {option.parentCountryName}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Plus size={14} className="mt-0.5 text-accent-500" />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-4 py-6 text-center text-sm text-slate-400">No matching destination</div>
                                        )}
                                    </div>,
                                    document.body
                                )}

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={roundTrip}
                                            onChange={(event) => setRoundTrip(event.target.checked)}
                                            className="h-4 w-4 rounded"
                                        />
                                        Roundtrip route
                                    </label>

                                    <div className={canLockRoute ? '' : 'opacity-50'}>
                                        <div className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={routeLock}
                                                    onChange={(event) => setRouteLock(event.target.checked)}
                                                    disabled={!canLockRoute}
                                                    className="h-4 w-4 rounded"
                                                />
                                                Route Lock
                                            </label>
                                            <button
                                                type="button"
                                                title="Route Lock keeps destination order exactly as selected and unlocks drag-and-drop ordering."
                                                aria-label="Route Lock keeps destination order exactly as selected and unlocks drag-and-drop ordering."
                                                className="rounded-full text-slate-400 transition-colors hover:text-slate-700"
                                            >
                                                <Info size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">Pin a destination to define your start and return location.</p>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <CalendarBlank size={17} weight="duotone" className="text-accent-600" />
                                    Dates
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
                                        Exact dates
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDateInputMode('flex')}
                                        className={[
                                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                                            dateInputMode === 'flex' ? 'bg-accent-50 text-accent-800' : 'text-slate-600 hover:text-slate-800',
                                        ].join(' ')}
                                    >
                                        Flexible window
                                    </button>
                                </div>

                                {dateInputMode === 'exact' ? (
                                    <DateRangePicker
                                        startDate={startDate}
                                        endDate={endDate}
                                        onChange={(newStartDate, newEndDate) => {
                                            setStartDate(newStartDate);
                                            setEndDate(newEndDate);
                                        }}
                                    />
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <NumberStepper label="Trip length (weeks)" value={flexWeeks} min={1} max={8} onChange={setFlexWeeks} />
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preferred time range</label>
                                            <select
                                                value={flexWindow}
                                                onChange={(event) => setFlexWindow(event.target.value as FlexWindow)}
                                                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                                            >
                                                <option value="spring">Spring window</option>
                                                <option value="summer">Summer window</option>
                                                <option value="autumn">Autumn window</option>
                                                <option value="winter">Winter window</option>
                                                <option value="shoulder">Shoulder season</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
                                    Draft timeframe: {dayCount} days total • departure in {daysUntilStart} day{daysUntilStart === 1 ? '' : 's'}.
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <UsersThree size={17} weight="duotone" className="text-accent-600" />
                                    Traveler setup
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {TRAVELER_OPTIONS.map((choice) => {
                                        const isActive = travelerType === choice.id;
                                        const Icon = choice.icon;
                                        const summary = choice.id === travelerType ? travelerDetailSummary : choice.subtitle;

                                        return (
                                            <div
                                                key={choice.id}
                                                onClick={() => setTravelerType(choice.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setTravelerType(choice.id);
                                                    }
                                                }}
                                                role="button"
                                                tabIndex={0}
                                                className={[
                                                    'group relative rounded-xl border px-3 py-3 text-left transition-colors',
                                                    isActive
                                                        ? 'border-accent-400 bg-accent-50 text-accent-900'
                                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                                                ].join(' ')}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        openTravelerSettings(choice.id);
                                                    }}
                                                    aria-label={`Edit ${choice.label} settings`}
                                                    title={`Edit ${choice.label} settings`}
                                                    className={[
                                                        'absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all',
                                                        isActive
                                                            ? 'border-accent-300 bg-white text-accent-700 opacity-100'
                                                            : 'border-slate-200 bg-white text-slate-500 opacity-0 group-hover:opacity-100',
                                                    ].join(' ')}
                                                >
                                                    <GearSix size={14} />
                                                </button>
                                                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                                                    <Icon size={17} weight="duotone" />
                                                    {choice.label}
                                                </span>
                                                <div className="mt-1 text-xs text-slate-500">{summary}</div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        <Sparkle size={16} weight="duotone" className="text-accent-600" />
                                        Trip style
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                        {STYLE_CHOICES.map((style) => {
                                            const active = selectedStyles.includes(style.id);
                                            const Icon = style.icon;

                                            return (
                                                <button
                                                    key={style.id}
                                                    type="button"
                                                    onClick={() => toggleStyle(style.id)}
                                                    className={[
                                                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                        active
                                                            ? 'border-accent-300 bg-accent-50 text-accent-800'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                    ].join(' ')}
                                                >
                                                    <Icon size={15} weight="duotone" />
                                                    {style.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pace</label>
                                        <select
                                            value={pace}
                                            onChange={(event) => setPace(event.target.value as PaceType)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                                        >
                                            <option>Relaxed</option>
                                            <option>Balanced</option>
                                            <option>Fast</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Budget</label>
                                        <select
                                            value={budget}
                                            onChange={(event) => setBudget(event.target.value as BudgetType)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                                        >
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Luxury</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        <Train size={16} weight="duotone" className="text-accent-600" />
                                        Transport preferences
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                        {TRANSPORT_OPTIONS.map((option) => {
                                            const active = transportModes.includes(option.id);
                                            const Icon = option.icon;

                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => toggleTransportMode(option.id)}
                                                    className={[
                                                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                        active
                                                            ? 'border-accent-300 bg-accent-50 text-accent-800'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                    ].join(' ')}
                                                >
                                                    <Icon size={15} weight="duotone" />
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {transportModes.includes('camper') && (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                <Van size={16} weight="duotone" className="text-accent-600" />
                                                Camper profile
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.1"
                                                    value={camperWeight}
                                                    onChange={(event) => setCamperWeight(event.target.value)}
                                                    placeholder="Vehicle weight"
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                                />
                                                <select
                                                    value={camperWeightUnit}
                                                    onChange={(event) => setCamperWeightUnit(event.target.value as 't' | 'kg')}
                                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                                                >
                                                    <option value="t">t (tons)</option>
                                                    <option value="kg">kg</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {isVanlifeOnly && (
                                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                                            Vanlife activated 🤙
                                        </div>
                                    )}

                                    {transportMismatch && (
                                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                            <WarningCircle size={14} className="mt-0.5 shrink-0" />
                                            Custom transport choices differ from profile suggestions. This may reduce pace/budget alignment.
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm sm:p-5">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Info size={16} weight="duotone" className="text-accent-600" />
                                    Special notes
                                </div>
                                <textarea
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    rows={4}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none"
                                    placeholder="Tell the planner what matters most for this trip."
                                />
                            </section>
                        </div>

                        <aside className="lg:sticky lg:top-24 lg:self-start">
                            <div className="space-y-4 rounded-2xl border border-indigo-300/20 bg-gradient-to-b from-[#0d1330] via-[#090f26] to-[#060915] p-4 text-slate-100 shadow-2xl sm:p-5">
                                <div>
                                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100">
                                        <Compass size={13} weight="duotone" />
                                        Trip snapshot
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
                                                Add destinations to preview your route.
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
                                                            <div className="text-sm font-semibold text-indigo-50">{destination}</div>
                                                            {isFirst && (
                                                                <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
                                                                    <MapPin size={12} weight="fill" />
                                                                    {roundTrip ? 'Start & End' : 'Start'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {isVanlifeOnly && (
                                    <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200">
                                        Vanlife activated 🤙
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <CalendarBlank size={15} weight="duotone" className="text-indigo-200" />
                                            {dayCount} days
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">Avg {averageDaysPerStop.toFixed(1)} per stop</div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <UsersThree size={15} weight="duotone" className="text-indigo-200" />
                                            {travelerLabel}
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{travelerDetailSummary}</div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <Train size={15} weight="duotone" className="text-indigo-200" />
                                            Transport
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{transportSummary}</div>
                                    </div>
                                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                            <Sparkle size={15} weight="duotone" className="text-indigo-200" />
                                            Style
                                        </div>
                                        <div className="mt-1 text-xs text-indigo-100/80">{selectedStyles.length} selected</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                                    <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-100">
                                        <Info size={13} weight="duotone" />
                                        Did you know
                                    </div>
                                    <p className="mt-2 text-sm text-indigo-50/95">{dynamicFact}</p>
                                </div>

                                <Link
                                    to={prefillUrl}
                                    className="inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-50"
                                >
                                    Create my trip
                                </Link>
                            </div>
                        </aside>
                    </section>
                </main>

                {settingsDialog}

                <SiteFooter className="relative z-10 mt-8" />
            </div>
        </div>
    );
};
