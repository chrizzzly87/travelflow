import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Backpack,
    Clock,
    MapPin,
    MagnifyingGlass,
    CalendarDots,
    Globe,
    Confetti,
    Lightning,
    Compass,
    AirplaneTakeoff,
    ArrowRight,
    Article,
} from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { trackEvent } from '../services/analyticsService';
import {
    categories,
    monthEntries,
    festivalEvents,
    weekendGetaways,
    countryGroups,
    quickIdeas,
    getAllDestinations,
} from '../data/inspirationsData';
import type { Destination, FestivalEvent as FestivalEventType, WeekendGetaway as WeekendGetawayType, CountryGroup, QuickIdea } from '../data/inspirationsData';
import { getBlogPostsBySlugs } from '../services/blogService';
import { buildCreateTripUrl, resolveDestinationCodes } from '../utils';

/* ── Festival date helpers ── */

const getNextOccurrence = (festival: FestivalEventType, now: Date): Date => {
    const currentYear = now.getFullYear();
    const thisYear = new Date(currentYear, festival.startMonth, festival.startDay);
    // If the festival end date (start + duration) is still in the future, use this year
    const endThisYear = new Date(thisYear.getTime() + festival.durationDays * 86400000);
    if (endThisYear >= now) {
        return thisYear;
    }
    return new Date(currentYear + 1, festival.startMonth, festival.startDay);
};

const formatFestivalDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toIso = (d: Date): string => d.toISOString().split('T')[0];

const addDaysLocal = (d: Date, n: number): Date => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
};

const nextSaturday = (): Date => {
    const now = new Date();
    const day = now.getDay();
    const diff = (6 - day + 7) % 7 || 7;
    return addDaysLocal(now, diff);
};

const suggestedStartForDays = (days: number): Date => {
    const now = new Date();
    return addDaysLocal(now, Math.max(14, days));
};

/* ── Blog link helper ── */

const BlogLinks: React.FC<{ slugs?: string[] }> = ({ slugs }) => {
    const posts = useMemo(() => getBlogPostsBySlugs(slugs || []), [slugs]);
    if (posts.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
            {posts.map((post) => (
                <Link
                    key={post.slug}
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
                >
                    <Article size={11} weight="duotone" />
                    {post.title}
                </Link>
            ))}
        </div>
    );
};

/* ── Section anchors ── */

const sections = [
    { id: 'themes', label: 'By Theme', icon: Compass },
    { id: 'months', label: 'By Month', icon: CalendarDots },
    { id: 'countries', label: 'By Country', icon: Globe },
    { id: 'festivals', label: 'Events & Festivals', icon: Confetti },
    { id: 'weekends', label: 'Weekend Getaways', icon: Lightning },
];

/* ── Destination card ── */

const DestinationCard: React.FC<{ destination: Destination }> = ({ destination }) => {
    const start = suggestedStartForDays(destination.durationDays);
    const end = addDaysLocal(start, destination.durationDays - 1);
    const countries = resolveDestinationCodes(destination.destinationCodes);
    const prefillUrl = buildCreateTripUrl({
        countries,
        cities: destination.cities?.join(', '),
        startDate: toIso(start),
        endDate: toIso(end),
        notes: destination.description,
        meta: { source: 'inspirations', label: destination.title },
    });

    return (
    <Link
        to={prefillUrl}
        onClick={() => trackEvent('inspirations__destination_card', { title: destination.title, country: destination.country })}
        className="group block rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
    >
        <div className={`relative h-32 rounded-t-2xl ${destination.mapColor} overflow-hidden`}>
            <div className={`absolute left-[22%] top-[28%] h-2.5 w-2.5 rounded-full ${destination.mapAccent}`} />
            <div className={`absolute left-[48%] top-[55%] h-2 w-2 rounded-full ${destination.mapAccent} opacity-70`} />
            <div className={`absolute left-[72%] top-[38%] h-3 w-3 rounded-full ${destination.mapAccent}`} />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 128" fill="none" preserveAspectRatio="none">
                <path d="M75 36 L163 70 L245 49" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="text-slate-400/40" />
            </svg>
            <div className="absolute bottom-2 right-2 rounded-full bg-white/80 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {destination.flag} {destination.country}
            </div>
        </div>

        <div className="p-4">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-accent-700 transition-colors">{destination.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 line-clamp-2">{destination.description}</p>
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Clock size={13} weight="duotone" className="text-accent-400" />{destination.durationDays} days</span>
                {destination.cities && destination.cities.length > 0 && (
                    <span className="inline-flex items-center gap-1"><MapPin size={13} weight="duotone" className="text-accent-400" />{destination.cities.length} {destination.cities.length === 1 ? 'city' : 'cities'}</span>
                )}
            </div>
        </div>
    </Link>
    );
};

/* ── Festival card ── */

const FestivalCard: React.FC<{ event: FestivalEventType; nextDate: Date }> = ({ event, nextDate }) => {
    const endDate = addDaysLocal(nextDate, event.durationDays - 1);
    const countries = resolveDestinationCodes(event.destinationCodes);
    const prefillUrl = buildCreateTripUrl({
        countries,
        cities: event.cities?.join(', '),
        startDate: toIso(nextDate),
        endDate: toIso(endDate),
        notes: event.description,
        meta: { source: 'inspirations', label: event.name },
    });

    return (
    <Link
        to={prefillUrl}
        onClick={() => trackEvent('inspirations__festival_card', { name: event.name, country: event.country })}
        className="group flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg hover:-translate-y-1"
    >
        <div className={`relative h-24 rounded-t-2xl ${event.mapColor} overflow-hidden flex items-center justify-center`}>
            <Confetti size={36} weight="duotone" className="text-slate-400/40" />
            <div className="absolute bottom-2 right-2 rounded-full bg-white/80 backdrop-blur px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {event.flag} {event.months}
            </div>
        </div>
        <div className="flex flex-1 flex-col p-4">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-accent-700 transition-colors">{event.name}</h3>
            <p className="mt-1 text-xs font-medium text-slate-400">{event.country}</p>
            <p className="mt-0.5 text-xs font-semibold text-fuchsia-600">Next: {formatFestivalDate(nextDate)}</p>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500 line-clamp-2">{event.description}</p>
            <div className="mt-3 flex items-center gap-1 text-xs text-slate-400">
                <Clock size={13} weight="duotone" className="text-accent-400" />
                {event.durationDays} days recommended
            </div>
            {event.blogSlugs && event.blogSlugs.length > 0 && (
                <div className="mt-2">
                    <BlogLinks slugs={event.blogSlugs} />
                </div>
            )}
        </div>
    </Link>
    );
};

/* ── Weekend getaway card ── */

const GetawayCard: React.FC<{ getaway: WeekendGetawayType }> = ({ getaway }) => {
    const start = nextSaturday();
    const end = addDaysLocal(start, getaway.durationDays - 1);
    const countries = resolveDestinationCodes(getaway.destinationCodes);
    const prefillUrl = buildCreateTripUrl({
        countries,
        cities: getaway.cities?.join(', '),
        startDate: toIso(start),
        endDate: toIso(end),
        notes: getaway.description,
        meta: { source: 'inspirations', label: getaway.title },
    });

    return (
    <Link
        to={prefillUrl}
        onClick={() => trackEvent('inspirations__getaway_card', { title: getaway.title, destination: getaway.to })}
        className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${getaway.mapColor}`}>
            <AirplaneTakeoff size={24} weight="duotone" className={getaway.mapAccent.replace('bg-', 'text-')} />
        </div>
        <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 group-hover:text-accent-700 transition-colors">{getaway.title}</h3>
            <p className="mt-0.5 text-xs font-medium text-slate-400">{getaway.flag} {getaway.to} · {getaway.durationDays} days</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500 line-clamp-2">{getaway.description}</p>
            {getaway.blogSlugs && getaway.blogSlugs.length > 0 && (
                <div className="mt-2">
                    <BlogLinks slugs={getaway.blogSlugs} />
                </div>
            )}
        </div>
        <ArrowRight size={18} weight="bold" className="mt-1 shrink-0 text-slate-300 transition-colors group-hover:text-accent-500" />
    </Link>
    );
};

/* ── Country pill ── */

const CountryPill: React.FC<{ group: CountryGroup }> = ({ group }) => (
    <Link
        to={`/inspirations/country/${encodeURIComponent(group.country)}`}
        onClick={() => trackEvent('inspirations__country_pill', { country: group.country })}
        className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
        <span className="text-3xl">{group.flag}</span>
        <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 group-hover:text-accent-700 transition-colors">{group.country}</h3>
            <p className="text-xs text-slate-400">{group.bestMonths}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
                {group.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{tag}</span>
                ))}
            </div>
            {group.blogSlugs && group.blogSlugs.length > 0 && (
                <div className="mt-2">
                    <BlogLinks slugs={group.blogSlugs} />
                </div>
            )}
        </div>
        <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-bold text-accent-600">{group.tripCount}</span>
    </Link>
);

/* ── Page ── */

export const InspirationsPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => new Date().getMonth());

    const allDestinations = useMemo(() => getAllDestinations(), []);

    const filteredDestinations = useMemo(() => {
        if (!search.trim()) return null;
        const q = search.toLowerCase();
        return allDestinations.filter(
            (d) =>
                d.title.toLowerCase().includes(q) ||
                d.country.toLowerCase().includes(q) ||
                d.description.toLowerCase().includes(q) ||
                d.tags.some((t) => t.includes(q))
        );
    }, [search, allDestinations]);

    const filteredFestivals = useMemo(() => {
        if (!search.trim()) return null;
        const q = search.toLowerCase();
        return festivalEvents.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                e.country.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q)
        );
    }, [search]);

    const filteredGetaways = useMemo(() => {
        if (!search.trim()) return null;
        const q = search.toLowerCase();
        return weekendGetaways.filter(
            (g) =>
                g.title.toLowerCase().includes(q) ||
                g.to.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q)
        );
    }, [search]);

    const isSearching = search.trim().length > 0;
    const totalSearchResults = isSearching
        ? (filteredDestinations?.length ?? 0) + (filteredFestivals?.length ?? 0) + (filteredGetaways?.length ?? 0)
        : 0;

    // Selected month data
    const selectedMonth = monthEntries[selectedMonthIndex];

    // Upcoming festivals sorted by next occurrence
    const upcomingFestivals = useMemo(() => {
        const now = new Date();
        return festivalEvents
            .map((event) => ({ ...event, nextDate: getNextOccurrence(event, now) }))
            .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
    }, []);

    return (
        <MarketingLayout>
            {/* ── Hero ── */}
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    <Backpack size={14} weight="duotone" />
                    Trip Inspirations
                </span>
                <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Where will you go next?
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    Not sure where to start? Browse curated trip ideas by theme, month, country, or upcoming festivals. Click any itinerary to use it as a starting point.
                </p>
            </section>

            {/* ── Search ── */}
            <section className="pb-6 animate-hero-stagger" style={{ '--stagger': '120ms' } as React.CSSProperties}>
                <div className="relative max-w-xl">
                    <MagnifyingGlass size={18} weight="duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search destinations, festivals, countries…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-shadow"
                    />
                    {isSearching && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                            {totalSearchResults} result{totalSearchResults !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </section>

            {/* ── Search results ── */}
            {isSearching && (
                <section className="pb-12">
                    {totalSearchResults === 0 && (
                        <p className="text-sm text-slate-400">No results found for &ldquo;{search}&rdquo;. Try a different keyword.</p>
                    )}
                    {filteredDestinations && filteredDestinations.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Destinations</h3>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredDestinations.map((d) => <DestinationCard key={d.title} destination={d} />)}
                            </div>
                        </div>
                    )}
                    {filteredFestivals && filteredFestivals.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Events & Festivals</h3>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredFestivals.map((e) => <FestivalCard key={e.name} event={e} nextDate={getNextOccurrence(e, new Date())} />)}
                            </div>
                        </div>
                    )}
                    {filteredGetaways && filteredGetaways.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Weekend Getaways</h3>
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredGetaways.map((g) => <GetawayCard key={g.title} getaway={g} />)}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* ── Quick navigation + Quick start (hidden while searching) ── */}
            {!isSearching && (
                <>
                    {/* Anchor nav */}
                    <nav className="pb-8 animate-hero-stagger" style={{ '--stagger': '200ms' } as React.CSSProperties}>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Jump to</h2>
                        <div className="flex flex-wrap gap-2">
                            {sections.map((s) => {
                                const SIcon = s.icon;
                                return (
                                    <a
                                        key={s.id}
                                        href={`#${s.id}`}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-accent-300 hover:text-accent-700 hover:shadow-md"
                                    >
                                        <SIcon size={14} weight="duotone" />
                                        {s.label}
                                    </a>
                                );
                            })}
                        </div>
                    </nav>

                    {/* Quick start pills */}
                    <section className="pb-12 animate-hero-stagger" style={{ '--stagger': '280ms' } as React.CSSProperties}>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Quick start</h2>
                        <div className="flex flex-wrap gap-2">
                            {quickIdeas.map((idea) => {
                                const start = suggestedStartForDays(idea.days);
                                const end = addDaysLocal(start, idea.days - 1);
                                const countries = resolveDestinationCodes([idea.destinationCode]);
                                return (
                                    <Link
                                        key={idea.label}
                                        to={buildCreateTripUrl({ countries, startDate: toIso(start), endDate: toIso(end), meta: { source: 'inspirations', label: idea.label } })}
                                        onClick={() => trackEvent('inspirations__quick_pill', { label: idea.label })}
                                        className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-accent-300 hover:text-accent-700 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]"
                                    >
                                        {idea.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {/* ── By Theme ── */}
                    <div id="themes">
                        {categories.map((category, idx) => {
                            const CategoryIcon = category.icon;
                            return (
                                <section key={category.id} className="py-12 md:py-16 border-t border-slate-200">
                                    <div className="animate-scroll-blur-in flex items-start gap-4">
                                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${category.color}`}>
                                            <CategoryIcon size={24} weight="duotone" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-4">
                                                <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">{category.title}</h2>
                                                {idx === 0 && (
                                                    <Link to="/inspirations/themes" onClick={() => trackEvent('inspirations__section--themes')} className="shrink-0 mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 hover:text-accent-800 transition-colors">
                                                        All themes
                                                        <ArrowRight size={14} weight="bold" />
                                                    </Link>
                                                )}
                                            </div>
                                            <p className="mt-1 text-base text-slate-500">{category.subtitle}</p>
                                            {category.blogSlugs && category.blogSlugs.length > 0 && (
                                                <div className="mt-2">
                                                    <BlogLinks slugs={category.blogSlugs} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                        {category.destinations.map((dest) => (
                                            <div key={dest.title} className="animate-scroll-fade-up">
                                                <DestinationCard destination={dest} />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>

                    {/* ── By Month (Tab Bar) ── */}
                    <section id="months" className="py-12 md:py-16 border-t border-slate-200">
                        <div className="animate-scroll-blur-in">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                                    <CalendarDots size={24} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Best Time to Travel</h2>
                                        <Link to="/inspirations/best-time-to-travel" onClick={() => trackEvent('inspirations__section--months')} className="shrink-0 mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 hover:text-accent-800 transition-colors">
                                            Month guide
                                            <ArrowRight size={14} weight="bold" />
                                        </Link>
                                    </div>
                                    <p className="mt-1 text-base text-slate-500">When to go where — pick a month</p>
                                </div>
                            </div>
                        </div>

                        {/* Month calendar strip */}
                        <div className="mt-6 -mx-4 px-4 overflow-x-auto scrollbar-hide md:mx-0 md:px-0">
                            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                                {monthEntries.map((entry) => (
                                    <button
                                        key={entry.monthIndex}
                                        onClick={() => setSelectedMonthIndex(entry.monthIndex)}
                                        className={`relative px-3.5 py-2 text-sm font-semibold transition-all rounded-lg whitespace-nowrap ${
                                            selectedMonthIndex === entry.monthIndex
                                                ? 'bg-white text-sky-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                    >
                                        {entry.month.slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Month content panel */}
                        <div
                            key={selectedMonthIndex}
                            className="mt-6 max-w-2xl animate-content-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                        >
                            <h3 className="text-xl font-black text-slate-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                {selectedMonth.month}
                            </h3>
                            <p className="mt-3 text-base leading-relaxed text-slate-600">{selectedMonth.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {selectedMonth.destinations.map((dest, i) => {
                                    const now = new Date();
                                    const monthNum = selectedMonthIndex;
                                    const year = monthNum >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
                                    const monthStart = new Date(year, monthNum, 1);
                                    const monthEnd = addDaysLocal(monthStart, 13);
                                    const countries = resolveDestinationCodes([selectedMonth.destinationCodes[i]]);
                                    return (
                                        <Link
                                            key={dest}
                                            to={buildCreateTripUrl({ countries, startDate: toIso(monthStart), endDate: toIso(monthEnd), meta: { source: 'inspirations', label: `${selectedMonth.month} in ${dest}` } })}
                                            className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-100"
                                        >
                                            {dest}
                                        </Link>
                                    );
                                })}
                            </div>
                            {selectedMonth.blogSlugs && selectedMonth.blogSlugs.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Related Articles</p>
                                    <BlogLinks slugs={selectedMonth.blogSlugs} />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ── By Country ── */}
                    <section id="countries" className="py-12 md:py-16 border-t border-slate-200">
                        <div className="animate-scroll-blur-in">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                                    <Globe size={24} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Browse by Country</h2>
                                        <Link to="/inspirations/countries" onClick={() => trackEvent('inspirations__section--countries')} className="shrink-0 mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 hover:text-accent-800 transition-colors">
                                            All countries
                                            <ArrowRight size={14} weight="bold" />
                                        </Link>
                                    </div>
                                    <p className="mt-1 text-base text-slate-500">Find trips by destination — {countryGroups.length} countries and counting</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {countryGroups.map((group) => (
                                <div key={group.country} className="animate-scroll-fade-up">
                                    <CountryPill group={group} />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Upcoming Events & Festivals ── */}
                    <section id="festivals" className="py-12 md:py-16 border-t border-slate-200">
                        <div className="animate-scroll-blur-in">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-600 ring-1 ring-fuchsia-100">
                                    <Confetti size={24} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Upcoming Events & Festivals</h2>
                                        <Link to="/inspirations/events-and-festivals" onClick={() => trackEvent('inspirations__section--festivals')} className="shrink-0 mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 hover:text-accent-800 transition-colors">
                                            All events
                                            <ArrowRight size={14} weight="bold" />
                                        </Link>
                                    </div>
                                    <p className="mt-1 text-base text-slate-500">
                                        {upcomingFestivals.length} celebrations sorted by next date — plan around the world's most unforgettable moments
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {upcomingFestivals.slice(0, 6).map((event) => (
                                <div key={event.name} className="animate-scroll-fade-up">
                                    <FestivalCard event={event} nextDate={event.nextDate} />
                                </div>
                            ))}
                        </div>
                        {upcomingFestivals.length > 6 && (
                            <div className="mt-8 text-center">
                                <Link
                                    to="/inspirations/events-and-festivals"
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-accent-300 hover:text-accent-700 hover:shadow-md"
                                >
                                    View all {upcomingFestivals.length} events
                                    <ArrowRight size={14} weight="bold" />
                                </Link>
                            </div>
                        )}
                    </section>

                    {/* ── Weekend Getaways ── */}
                    <section id="weekends" className="py-12 md:py-16 border-t border-slate-200">
                        <div className="animate-scroll-blur-in">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                                    <Lightning size={24} weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Spontaneous Weekend Getaways</h2>
                                        <Link to="/inspirations/weekend-getaways" onClick={() => trackEvent('inspirations__section--weekends')} className="shrink-0 mt-1 inline-flex items-center gap-1 text-sm font-semibold text-accent-600 hover:text-accent-800 transition-colors">
                                            All getaways
                                            <ArrowRight size={14} weight="bold" />
                                        </Link>
                                    </div>
                                    <p className="mt-1 text-base text-slate-500">Short trips you can book on a whim — 2–3 days, zero overthinking</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {weekendGetaways.map((getaway) => (
                                <div key={getaway.title} className="animate-scroll-fade-up">
                                    <GetawayCard getaway={getaway} />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Stats strip ── */}
                    <section className="py-14 md:py-20 border-t border-slate-200">
                        <div className="animate-scroll-blur-in grid gap-8 text-center sm:grid-cols-2 md:grid-cols-4">
                            <div>
                                <div className="text-4xl font-black text-accent-600">18+</div>
                                <div className="mt-1 text-sm text-slate-500">Curated destinations</div>
                            </div>
                            <div>
                                <div className="text-4xl font-black text-accent-600">12</div>
                                <div className="mt-1 text-sm text-slate-500">Countries covered</div>
                            </div>
                            <div>
                                <div className="text-4xl font-black text-accent-600">{festivalEvents.length}</div>
                                <div className="mt-1 text-sm text-slate-500">Festivals & events</div>
                            </div>
                            <div>
                                <div className="text-4xl font-black text-accent-600">6</div>
                                <div className="mt-1 text-sm text-slate-500">Weekend getaways</div>
                            </div>
                        </div>
                    </section>

                    {/* ── Bottom CTA ── */}
                    <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                        <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                            <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent-400/20 blur-[50px]" />

                            <h2 className="relative text-3xl font-black tracking-tight text-white md:text-5xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                                Feeling inspired?
                            </h2>
                            <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                                Pick a destination and let our AI turn it into a day-by-day plan in seconds.
                            </p>
                            <Link
                                to="/create-trip"
                                onClick={() => trackEvent('inspirations__bottom_cta')}
                                className="relative mt-8 inline-block rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                            >
                                Start Planning Now
                            </Link>
                        </div>
                    </section>
                </>
            )}
        </MarketingLayout>
    );
};
