import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Calendar,
    Check,
    Compass,
    MagicWand,
    MapPinLine,
    Notebook,
    ShootingStar,
    Sparkle,
    Strategy,
    X,
} from '@phosphor-icons/react';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { useDbSync } from '../hooks/useDbSync';
import { AppLanguage } from '../types';
import { buildCreateTripUrl, getDestinationOptionByName, resolveDestinationName, searchDestinationOptions } from '../utils';

interface CreateTripJourneyArchitectLabPageProps {
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}

interface StepConfig {
    id: string;
    title: string;
    subtitle: string;
}

const STEPS: StepConfig[] = [
    { id: 'scope', title: 'Scope', subtitle: 'Pick where to go' },
    { id: 'timing', title: 'Timing', subtitle: 'Define the travel window' },
    { id: 'style', title: 'Style', subtitle: 'Set vibe and logistics' },
    { id: 'review', title: 'Review', subtitle: 'Generate final brief' },
];

const PRIORITY_OPTIONS = ['Food scenes', 'Nature days', 'Beach time', 'Culture', 'Night energy', 'Photo spots'];
const LOGISTICS_OPTIONS = ['Minimal transit', 'Public transport', 'Roadtrip freedom', 'Family-friendly'];
const ARCHETYPES = [
    {
        id: 'balanced-loop',
        title: 'Balanced Loop',
        summary: 'Mix iconic stops with one slower anchor location.',
        notes: 'Balanced route with two high-energy city days and one buffer day each week.',
        pace: 'Balanced' as const,
    },
    {
        id: 'island-reset',
        title: 'Island Reset',
        summary: 'Fewer moves, scenic coastlines, recovery time.',
        notes: 'Keep transfer count low and reserve full days for beaches and local dining.',
        pace: 'Relaxed' as const,
    },
    {
        id: 'city-sprint',
        title: 'City Sprint',
        summary: 'Dense route for high variety in limited time.',
        notes: 'Prioritize central stays and efficient point-to-point transitions.',
        pace: 'Fast' as const,
    },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const getInitialDates = (): { startDate: string; endDate: string } => {
    const start = addDays(new Date(), 40);
    const end = addDays(start, 11);
    return {
        startDate: toIsoDate(start),
        endDate: toIsoDate(end),
    };
};

export const CreateTripJourneyArchitectLabPage: React.FC<CreateTripJourneyArchitectLabPageProps> = ({ onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);

    const initialDates = useMemo(() => getInitialDates(), []);
    const [step, setStep] = useState(0);
    const [query, setQuery] = useState('');
    const [destinations, setDestinations] = useState<string[]>(['Greece', 'Crete']);
    const [startDate, setStartDate] = useState(initialDates.startDate);
    const [endDate, setEndDate] = useState(initialDates.endDate);
    const [pace, setPace] = useState<'Relaxed' | 'Balanced' | 'Fast'>('Balanced');
    const [budget, setBudget] = useState<'Low' | 'Medium' | 'High' | 'Luxury'>('Medium');
    const [selectedPriorities, setSelectedPriorities] = useState<string[]>(['Food scenes', 'Beach time']);
    const [selectedLogistics, setSelectedLogistics] = useState<string[]>(['Minimal transit']);
    const [notes, setNotes] = useState('Sunset-focused route, local tavernas, and one sailing day.');
    const [activeArchetype, setActiveArchetype] = useState<string>('balanced-loop');

    const suggestions = useMemo(
        () => searchDestinationOptions(query, { excludeNames: destinations, limit: 7 }),
        [destinations, query]
    );

    const dayCount = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const diff = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
        return Number.isFinite(diff) ? Math.max(1, diff) : 1;
    }, [startDate, endDate]);

    const stepCompletion = useMemo(() => {
        const first = destinations.length > 0;
        const second = startDate.length > 0 && endDate.length > 0 && dayCount > 0;
        const third = selectedPriorities.length > 0;
        const fourth = notes.trim().length > 10;
        return [first, second, third, fourth];
    }, [dayCount, destinations.length, endDate.length, notes, selectedPriorities.length, startDate.length]);

    const completionCount = stepCompletion.filter(Boolean).length;
    const progressPercent = Math.round((completionCount / STEPS.length) * 100);

    const structuredNotes = useMemo(() => {
        const parts = [notes.trim()];
        if (selectedPriorities.length > 0) parts.push(`Priorities: ${selectedPriorities.join(', ')}.`);
        if (selectedLogistics.length > 0) parts.push(`Logistics: ${selectedLogistics.join(', ')}.`);
        parts.push(`Archetype: ${activeArchetype}.`);
        return parts.filter(Boolean).join(' ');
    }, [activeArchetype, notes, selectedLogistics, selectedPriorities]);

    const prefillUrl = useMemo(
        () =>
            buildCreateTripUrl({
                mode: 'classic',
                countries: destinations,
                startDate,
                endDate,
                pace,
                budget,
                notes: structuredNotes,
                meta: {
                    source: 'create-trip-labs',
                    label: 'Journey Architect Lab',
                },
            }),
        [budget, destinations, endDate, pace, startDate, structuredNotes]
    );

    const addDestination = (value: string) => {
        const normalized = resolveDestinationName(value);
        if (!normalized) return;
        const alreadyExists = destinations.some((entry) => entry.toLocaleLowerCase() === normalized.toLocaleLowerCase());
        if (alreadyExists) return;
        setDestinations((prev) => [...prev, normalized]);
    };

    const removeDestination = (value: string) => {
        setDestinations((prev) => prev.filter((entry) => entry !== value));
    };

    const toggleItem = (list: string[], value: string, setter: (values: string[]) => void) => {
        if (list.includes(value)) {
            setter(list.filter((entry) => entry !== value));
            return;
        }
        setter([...list, value]);
    };

    const applyArchetype = (archetypeId: string) => {
        const archetype = ARCHETYPES.find((item) => item.id === archetypeId);
        if (!archetype) return;
        setActiveArchetype(archetype.id);
        setPace(archetype.pace);
        setNotes(archetype.notes);
    };

    const goNext = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
    const goBack = () => setStep((current) => Math.max(current - 1, 0));

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf0_0%,#fff_38%,#f8fafc_100%)] text-slate-900">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-[-140px] top-0 h-[420px] w-[420px] rounded-full bg-amber-200/50 blur-3xl" />
                <div className="absolute right-[-120px] top-[140px] h-[360px] w-[360px] rounded-full bg-rose-200/40 blur-3xl" />
                <div className="absolute bottom-[-140px] left-1/3 h-[340px] w-[340px] rounded-full bg-accent-200/60 blur-3xl" />
            </div>

            <div className="relative z-10">
                <SiteHeader variant="glass" onMyTripsClick={onOpenManager} />
                <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                                <ShootingStar size={14} />
                                Lab Concept 3
                            </div>
                            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Journey Architect</h1>
                            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                                A guided flow that helps users define trip intent first, then translates it into a classic-ready planning brief.
                            </p>
                        </div>
                        <Link
                            to="/create-trip"
                            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-700"
                        >
                            Back to current create-trip
                        </Link>
                    </div>

                    <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                        <aside className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-lg backdrop-blur sm:p-5 lg:sticky lg:top-24 lg:h-fit">
                            <div className="mb-4">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Flow Progress</div>
                                <div className="mt-2 h-2 rounded-full bg-slate-100">
                                    <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-accent-500 transition-all" style={{ width: `${progressPercent}%` }} />
                                </div>
                                <div className="mt-2 text-xs text-slate-500">{completionCount}/{STEPS.length} sections complete</div>
                            </div>

                            <div className="space-y-2">
                                {STEPS.map((item, index) => {
                                    const isActive = step === index;
                                    const isDone = stepCompletion[index];
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setStep(index)}
                                            className={[
                                                'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                                                isActive ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold text-slate-800">{item.title}</span>
                                                {isDone ? <Check size={14} className="text-emerald-500" /> : <span className="text-xs text-slate-400">Step {index + 1}</span>}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">{item.subtitle}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Intent Snapshot</div>
                                <div className="mt-2 text-sm text-slate-700">{destinations.join(' -> ')}</div>
                                <div className="mt-1 text-xs text-slate-500">{dayCount} days, {pace.toLowerCase()} pace</div>
                            </div>
                        </aside>

                        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-xl backdrop-blur sm:p-6">
                            {step === 0 && (
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Start with the journey shape</h2>
                                        <p className="mt-1 text-sm text-slate-600">Pick an archetype first, then add countries/islands that match it.</p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {ARCHETYPES.map((archetype) => (
                                            <button
                                                key={archetype.id}
                                                type="button"
                                                onClick={() => applyArchetype(archetype.id)}
                                                className={[
                                                    'rounded-2xl border p-3 text-left transition-colors',
                                                    activeArchetype === archetype.id
                                                        ? 'border-amber-300 bg-amber-50'
                                                        : 'border-slate-200 bg-white hover:border-slate-300',
                                                ].join(' ')}
                                            >
                                                <div className="text-sm font-semibold text-slate-800">{archetype.title}</div>
                                                <div className="mt-1 text-xs text-slate-500">{archetype.summary}</div>
                                            </button>
                                        ))}
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Where do you want to go?</label>
                                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                {destinations.map((destination) => {
                                                    const option = getDestinationOptionByName(destination);
                                                    return (
                                                        <span
                                                            key={destination}
                                                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                                                        >
                                                            {option?.flag || '🌍'} {destination}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeDestination(destination)}
                                                                className="text-slate-400 transition-colors hover:text-slate-700"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                <MapPinLine size={16} className="text-amber-500" />
                                                <input
                                                    value={query}
                                                    onChange={(event) => setQuery(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            if (suggestions[0]) {
                                                                addDestination(suggestions[0].name);
                                                                setQuery('');
                                                            }
                                                        }
                                                    }}
                                                    placeholder="Search countries or islands"
                                                    className="w-full bg-transparent text-sm outline-none"
                                                />
                                            </div>
                                            {query.trim() && (
                                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                    {suggestions.map((option) => (
                                                        <button
                                                            key={option.code}
                                                            type="button"
                                                            onClick={() => {
                                                                addDestination(option.name);
                                                                setQuery('');
                                                            }}
                                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:border-amber-300"
                                                        >
                                                            {option.flag} {option.name}
                                                        </button>
                                                    ))}
                                                    {suggestions.length === 0 && (
                                                        <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 sm:col-span-2">No destination matches.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Set timing and tempo</h2>
                                        <p className="mt-1 text-sm text-slate-600">This step defines your travel window and speed.</p>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Start Date</label>
                                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                <Calendar size={16} className="text-amber-500" />
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(event) => setStartDate(event.target.value)}
                                                    className="w-full bg-transparent text-sm outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">End Date</label>
                                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                <Calendar size={16} className="text-amber-500" />
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(event) => setEndDate(event.target.value)}
                                                    className="w-full bg-transparent text-sm outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Trip pace</div>
                                                <div className="mt-1 text-sm text-slate-600">Current: {pace}</div>
                                            </div>
                                            <Compass size={18} className="text-amber-500" />
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                            {(['Relaxed', 'Balanced', 'Fast'] as const).map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => setPace(value)}
                                                    className={[
                                                        'rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                        pace === value
                                                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                                                    ].join(' ')}
                                                >
                                                    {value}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Choose experiences and constraints</h2>
                                        <p className="mt-1 text-sm text-slate-600">This defines what the itinerary should optimize for.</p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Experience priorities</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {PRIORITY_OPTIONS.map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => toggleItem(selectedPriorities, option, setSelectedPriorities)}
                                                    className={[
                                                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                                                        selectedPriorities.includes(option)
                                                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                    ].join(' ')}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Logistics preferences</label>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {LOGISTICS_OPTIONS.map((option) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => toggleItem(selectedLogistics, option, setSelectedLogistics)}
                                                    className={[
                                                        'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                                                        selectedLogistics.includes(option)
                                                            ? 'border-accent-300 bg-accent-50 text-accent-800'
                                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                                                    ].join(' ')}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Budget</label>
                                            <select
                                                value={budget}
                                                onChange={(event) => setBudget(event.target.value as 'Low' | 'Medium' | 'High' | 'Luxury')}
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                                            >
                                                <option>Low</option>
                                                <option>Medium</option>
                                                <option>High</option>
                                                <option>Luxury</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Travel brief</label>
                                            <textarea
                                                value={notes}
                                                onChange={(event) => setNotes(event.target.value)}
                                                rows={3}
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900">Review and hand off</h2>
                                        <p className="mt-1 text-sm text-slate-600">Final check before sending this brief to the classic generator.</p>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Route</div>
                                            <div className="mt-2 text-sm font-medium text-slate-800">{destinations.join(' -> ')}</div>
                                            <div className="mt-1 text-xs text-slate-500">{dayCount} days total</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Planning profile</div>
                                            <div className="mt-2 text-sm font-medium text-slate-800">{pace} pace, {budget} budget</div>
                                            <div className="mt-1 text-xs text-slate-500">Archetype: {ARCHETYPES.find((item) => item.id === activeArchetype)?.title}</div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                            <Notebook size={14} />
                                            Structured Prompt Preview
                                        </div>
                                        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{structuredNotes}</p>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <Link
                                            to={prefillUrl}
                                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                                        >
                                            Send to Classic
                                            <ArrowRight size={14} />
                                        </Link>
                                        <Link
                                            to="/create-trip/labs/split-workspace"
                                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
                                        >
                                            Compare with split layout
                                        </Link>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={goBack}
                                    disabled={step === 0}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Back
                                </button>
                                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">
                                    {stepCompletion[step] ? <Check size={14} className="text-emerald-500" /> : <Sparkle size={14} className="text-amber-500" />}
                                    {stepCompletion[step] ? 'Step complete' : 'Step in progress'}
                                </div>
                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={step === STEPS.length - 1}
                                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                    <Strategy size={14} />
                                    Design Notes
                                </div>
                                <p className="mt-1 text-sm text-slate-600">This concept prioritizes guided intent capture before detailed fields.</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                <MagicWand size={14} />
                                Works best for first-time planners
                            </div>
                        </div>
                    </section>
                </main>
                <SiteFooter className="relative z-10 mt-6" />
            </div>
        </div>
    );
};
