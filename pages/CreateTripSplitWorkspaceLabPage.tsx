import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AirplaneTilt,
    CalendarDots,
    ChartLineUp,
    CheckCircle,
    CompassRose,
    GlobeHemisphereWest,
    Lightning,
    MapTrifold,
    Plus,
    Train,
    Truck,
    X,
} from '@phosphor-icons/react';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { useDbSync } from '../hooks/useDbSync';
import { AppLanguage } from '../types';
import { buildCreateTripUrl, getDestinationOptionByName, resolveDestinationName, searchDestinationOptions } from '../utils';

interface CreateTripSplitWorkspaceLabPageProps {
    onOpenManager: () => void;
    onLanguageLoaded?: (lang: AppLanguage) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TRANSPORT_OPTIONS = [
    { id: 'flight', label: 'Flights', icon: AirplaneTilt },
    { id: 'rail', label: 'Rail', icon: Train },
    { id: 'road', label: 'Roadtrip', icon: Truck },
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

const getInitialRange = (): { startDate: string; endDate: string } => {
    const start = addDays(new Date(), 30);
    const end = addDays(start, 12);
    return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

export const CreateTripSplitWorkspaceLabPage: React.FC<CreateTripSplitWorkspaceLabPageProps> = ({ onOpenManager, onLanguageLoaded }) => {
    useDbSync(onLanguageLoaded);

    const initialRange = useMemo(() => getInitialRange(), []);
    const [query, setQuery] = useState('');
    const [destinations, setDestinations] = useState<string[]>(['Japan', 'Okinawa']);
    const [startDate, setStartDate] = useState(initialRange.startDate);
    const [endDate, setEndDate] = useState(initialRange.endDate);
    const [pace, setPace] = useState<'Relaxed' | 'Balanced' | 'Fast'>('Balanced');
    const [budget, setBudget] = useState<'Low' | 'Medium' | 'High' | 'Luxury'>('High');
    const [tripGoal, setTripGoal] = useState<'highlights' | 'deep-dive' | 'mixed'>('mixed');
    const [transportModes, setTransportModes] = useState<string[]>(['flight', 'rail']);
    const [notes, setNotes] = useState('Mix city design districts with beach reset days. Prioritize direct transfers.');

    const suggestions = useMemo(
        () => searchDestinationOptions(query, { excludeNames: destinations, limit: 6 }),
        [destinations, query]
    );

    const dayCount = useMemo(() => {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const diff = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
        return Number.isFinite(diff) ? Math.max(1, diff) : 1;
    }, [startDate, endDate]);

    const readinessScore = useMemo(() => {
        let score = 25;
        if (destinations.length >= 2) score += 20;
        if (dayCount >= 5) score += 15;
        if (transportModes.length > 0) score += 20;
        if (notes.trim().length > 20) score += 20;
        return Math.min(score, 100);
    }, [dayCount, destinations.length, notes, transportModes.length]);

    const nightsPerStop = useMemo(() => {
        if (destinations.length === 0) return [] as number[];
        const slots = Math.max(dayCount - 1, 1);
        const base = Math.floor(slots / destinations.length);
        const remainder = slots % destinations.length;
        return destinations.map((_, index) => base + (index < remainder ? 1 : 0));
    }, [dayCount, destinations]);

    const recommendation = useMemo(() => {
        if (tripGoal === 'highlights') return 'Fast highlight routing with iconic places first.';
        if (tripGoal === 'deep-dive') return 'Longer stays and fewer moves for deeper local context.';
        return 'Balanced route with one anchor city and one recovery segment.';
    }, [tripGoal]);

    const prefillUrl = useMemo(
        () =>
            buildCreateTripUrl({
                mode: 'classic',
                countries: destinations,
                startDate,
                endDate,
                pace,
                budget,
                notes,
                meta: {
                    source: 'create-trip-labs',
                    label: 'Split Workspace Lab',
                },
            }),
        [budget, destinations, endDate, notes, pace, startDate]
    );

    const addDestination = (value: string) => {
        const normalized = resolveDestinationName(value);
        if (!normalized) return;
        const exists = destinations.some((entry) => entry.toLocaleLowerCase() === normalized.toLocaleLowerCase());
        if (exists) return;
        setDestinations((prev) => [...prev, normalized]);
    };

    const removeDestination = (value: string) => {
        setDestinations((prev) => prev.filter((entry) => entry !== value));
    };

    const toggleTransport = (id: string) => {
        setTransportModes((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-[-120px] top-[-140px] h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute right-[-140px] top-[120px] h-[420px] w-[420px] rounded-full bg-accent-500/30 blur-3xl" />
                <div className="absolute bottom-[-180px] left-1/3 h-[380px] w-[380px] rounded-full bg-emerald-400/20 blur-3xl" />
            </div>

            <div className="relative z-10">
                <SiteHeader variant="glass" onMyTripsClick={onOpenManager} />
                <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                                <ChartLineUp size={14} />
                                Lab Concept 2
                            </div>
                            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Split Workspace 50/50</h1>
                            <p className="mt-2 text-sm text-slate-300 sm:text-base">
                                Full-width planning with a live right panel that mirrors every decision as you build the trip.
                            </p>
                        </div>
                        <Link
                            to="/create-trip"
                            className="inline-flex items-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                        >
                            Back to current create-trip
                        </Link>
                    </div>

                    <section className="grid flex-1 gap-4 lg:min-h-[calc(100vh-230px)] lg:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl backdrop-blur sm:p-6">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Trip Inputs</h2>
                                    <p className="text-sm text-slate-400">Keep editing while the live panel updates instantly.</p>
                                </div>
                                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                                    {readinessScore}% ready
                                </span>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Countries, Islands, Regions</label>
                                    <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                                        <div className="mb-3 flex flex-wrap gap-2">
                                            {destinations.map((destination) => {
                                                const option = getDestinationOptionByName(destination);
                                                return (
                                                    <span
                                                        key={destination}
                                                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm"
                                                    >
                                                        {option?.flag || '🌍'} {destination}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDestination(destination)}
                                                            className="text-slate-400 transition-colors hover:text-white"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                            <MapTrifold size={16} className="text-cyan-200" />
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
                                                placeholder="Add destination"
                                                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                                            />
                                        </div>
                                        {query.trim() && (
                                            <div className="mt-2 grid gap-2">
                                                {suggestions.map((option) => (
                                                    <button
                                                        key={option.code}
                                                        type="button"
                                                        onClick={() => {
                                                            addDestination(option.name);
                                                            setQuery('');
                                                        }}
                                                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:border-cyan-300/60"
                                                    >
                                                        <span>{option.flag} {option.name}</span>
                                                        <Plus size={14} className="text-cyan-200" />
                                                    </button>
                                                ))}
                                                {suggestions.length === 0 && (
                                                    <p className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-slate-500">No match found.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Start</label>
                                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                            <CalendarDots size={16} className="text-cyan-200" />
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(event) => setStartDate(event.target.value)}
                                                className="w-full bg-transparent text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">End</label>
                                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                            <CalendarDots size={16} className="text-cyan-200" />
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(event) => setEndDate(event.target.value)}
                                                className="w-full bg-transparent text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Pace</label>
                                        <select
                                            value={pace}
                                            onChange={(event) => setPace(event.target.value as 'Relaxed' | 'Balanced' | 'Fast')}
                                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                                        >
                                            <option>Relaxed</option>
                                            <option>Balanced</option>
                                            <option>Fast</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Budget</label>
                                        <select
                                            value={budget}
                                            onChange={(event) => setBudget(event.target.value as 'Low' | 'Medium' | 'High' | 'Luxury')}
                                            className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
                                        >
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Luxury</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Trip Goal</label>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        <button
                                            type="button"
                                            onClick={() => setTripGoal('highlights')}
                                            className={[
                                                'rounded-xl border px-3 py-2 text-sm transition-colors',
                                                tripGoal === 'highlights' ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300',
                                            ].join(' ')}
                                        >
                                            Highlights
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTripGoal('mixed')}
                                            className={[
                                                'rounded-xl border px-3 py-2 text-sm transition-colors',
                                                tripGoal === 'mixed' ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300',
                                            ].join(' ')}
                                        >
                                            Mixed
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTripGoal('deep-dive')}
                                            className={[
                                                'rounded-xl border px-3 py-2 text-sm transition-colors',
                                                tripGoal === 'deep-dive' ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300',
                                            ].join(' ')}
                                        >
                                            Deep Dive
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Transport Preference</label>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                        {TRANSPORT_OPTIONS.map((option) => {
                                            const Icon = option.icon;
                                            const active = transportModes.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => toggleTransport(option.id)}
                                                    className={[
                                                        'rounded-xl border px-3 py-2 text-sm transition-colors',
                                                        active ? 'border-cyan-300/70 bg-cyan-400/10 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-300',
                                                    ].join(' ')}
                                                >
                                                    <span className="inline-flex items-center gap-2">
                                                        <Icon size={15} />
                                                        {option.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Planner Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(event) => setNotes(event.target.value)}
                                        rows={3}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                                        placeholder="Any preferences the planner should prioritize"
                                    />
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <Link
                                        to={prefillUrl}
                                        className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
                                    >
                                        Use this setup in Classic
                                    </Link>
                                    <Link
                                        to="/create-trip/labs/classic-card"
                                        className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                                    >
                                        Compare with card concept
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl backdrop-blur sm:p-6">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Live Planning Intelligence</h2>
                                    <p className="text-sm text-slate-400">This panel uses all available space to explain what your choices imply.</p>
                                </div>
                                <CompassRose size={22} className="text-cyan-200" />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0 p-4">
                                <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-slate-300">
                                    <span>Readiness</span>
                                    <span>{readinessScore}%</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-white/10">
                                    <div
                                        className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-accent-300 to-emerald-300 transition-all"
                                        style={{ width: `${readinessScore}%` }}
                                    />
                                </div>
                                <p className="mt-3 text-sm text-slate-200">{recommendation}</p>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trip Length</div>
                                    <div className="mt-1 text-2xl font-semibold text-white">{dayCount} days</div>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Stops</div>
                                    <div className="mt-1 text-2xl font-semibold text-white">{destinations.length}</div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Route Draft</div>
                                    <GlobeHemisphereWest size={16} className="text-cyan-200" />
                                </div>
                                <div className="space-y-2">
                                    {destinations.map((destination, index) => {
                                        const option = getDestinationOptionByName(destination);
                                        const nights = nightsPerStop[index] || 1;
                                        return (
                                            <div key={destination} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium text-slate-100">{option?.flag || '🌍'} {destination}</span>
                                                    <span className="text-cyan-200">{nights} night{nights === 1 ? '' : 's'}</span>
                                                </div>
                                                <div className="mt-1 text-xs text-slate-400">Stop {index + 1} of {destinations.length}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Live guidance</div>
                                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle size={16} className="mt-0.5 text-emerald-300" />
                                        Pace and duration are aligned for {tripGoal === 'deep-dive' ? 'deeper local time.' : 'a practical route.'}
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Lightning size={16} className="mt-0.5 text-amber-300" />
                                        {transportModes.length > 1 ? 'Multi-mode transport selected for flexibility.' : 'Consider one backup transport mode for resilience.'}
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <AirplaneTilt size={16} className="mt-0.5 text-cyan-300" />
                                        Good candidate to auto-generate in the classic planner.
                                    </li>
                                </ul>
                            </div>
                        </aside>
                    </section>
                </main>
                <SiteFooter className="relative z-10 mt-6 border-white/10 bg-slate-950/70" />
            </div>
        </div>
    );
};
