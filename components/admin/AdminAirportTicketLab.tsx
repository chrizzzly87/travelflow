import React, { useMemo, useState } from 'react';
import { AirplaneTakeoff, MapPin, WarningCircle } from '@phosphor-icons/react';

import { AdminSurfaceCard } from './AdminSurfaceCard';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { cn } from '../../lib/utils';
import type { AirportReference, NearbyAirportsResponse } from '../../shared/airportReference';
import {
    buildFakeAirportTicket,
    type FakeAirportTicket,
    type FakeAirportTicketCabinClass,
} from '../../shared/fakeAirportTicket';

/**
 * The ticket lab on Admin → Airports: a boarding-pass mock-up built from the
 * nearest commercial airport the nearby tester found, so the future ticket
 * experience can be judged against real airport data. It reads the tester's
 * result and never calls the network itself (the QR image aside).
 */

/** A small form label: sentence case, muted, no tracking (docs/DESIGN.md). */
const ADMIN_FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground';

const formatDistance = (value: number): string => `${value.toFixed(value >= 100 ? 0 : 1)} km`;

const TICKET_CABIN_OPTIONS: Array<{ value: FakeAirportTicketCabinClass; label: string }> = [
    { value: 'economy', label: 'Economy' },
    { value: 'business', label: 'Business' },
    { value: 'first', label: 'First' },
];
const TICKET_DESTINATION_PRIORITY = ['JFK', 'LHR', 'CDG', 'DXB', 'SIN', 'HND', 'LAX', 'SFO'];

const formatCabinClassLabel = (cabinClass: FakeAirportTicketCabinClass): string => {
    if (cabinClass === 'first') return 'First';
    if (cabinClass === 'business') return 'Business';
    return 'Economy';
};

const formatAirportTicketLocationLabel = (airport: AirportReference): string => (
    [airport.municipality, airport.countryName].filter(Boolean).join(', ') || airport.name
);

const TICKET_QR_FALLBACK_DOMAIN = 'https://travelflowapp.netlify.app';

const buildTicketBarcodeBars = (token: string): Array<{ id: string; width: number; muted: boolean }> => {
    const normalized = token.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'TRAVELFLOW';
    return Array.from({ length: 64 }, (_, index) => {
        const charCode = normalized.charCodeAt(index % normalized.length);
        return {
            id: `ticket-bar-${index}`,
            width: 1 + (charCode % 3),
            muted: index % 9 === 0,
        };
    });
};

const buildTicketQrCodeUrl = (url: string): string => (
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(url)}`
);

const formatTicketMetaValue = (value: string): string => value.replace(/\s+/g, ' ').trim();

const TICKET_CARD_SHADOW = 'shadow-[0_1px_0_rgba(255,255,255,0.72)_inset,0_30px_50px_-36px_rgba(15,23,42,0.46),0_14px_28px_-18px_rgba(15,23,42,0.18),0_0_0_1px_rgba(148,163,184,0.1)]';

const TicketRouteLine: React.FC<{ vertical?: boolean }> = ({ vertical = false }) => {
    if (vertical) {
        return (
            <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
                <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-slate-300 dark:bg-slate-600" />
                <span className="absolute left-1/2 top-1/2 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)]">
                    <AirplaneTakeoff size={18} weight="fill" className="-rotate-90" />
                </span>
            </div>
        );
    }

    return (
        <div className="relative flex h-12 items-center justify-center" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-slate-300 dark:bg-slate-600" />
            <span className="absolute left-1/2 top-1/2 inline-flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)]">
                <AirplaneTakeoff size={18} weight="fill" />
            </span>
        </div>
    );
};

const TicketMetaPill: React.FC<{
    label: string;
    value: string;
}> = ({ label, value }) => (
    <div className="min-w-0 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
        <div
            className="font-heading truncate text-[1.05rem] font-black tracking-[-0.04em] text-foreground"
            title={formatTicketMetaValue(value)}
        >
            {formatTicketMetaValue(value)}
        </div>
    </div>
);

const TicketBarcode: React.FC<{
    bars: Array<{ id: string; width: number; muted: boolean }>;
}> = ({ bars }) => (
    // Always dark bars on white, as on a printed pass: on the dark-mode card
    // fill the slate-950 bars were invisible.
    <div className="overflow-hidden rounded-[10px] border border-border bg-white p-3">
        <div className="flex h-[84px] items-stretch gap-px" aria-hidden="true">
            {bars.map((bar) => (
                <span
                    key={bar.id}
                    className={cn('block h-full', bar.muted ? 'bg-slate-500/65' : 'bg-slate-950')}
                    style={{ width: `${bar.width}px` }}
                />
            ))}
        </div>
    </div>
);

const TicketQrBadge: React.FC<{
    qrCodeUrl: string;
}> = ({ qrCodeUrl }) => (
    <div className="flex flex-col items-center gap-2 rounded-[10px] border border-border bg-card p-3">
        <img
            src={qrCodeUrl}
            alt="TravelFlow QR code"
            className="size-20 rounded-[8px] border border-border bg-secondary object-cover"
            draggable={false}
        />
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scan</div>
    </div>
);

const AirportTicketPreviewCard: React.FC<{
    ticket: FakeAirportTicket;
    barcodeBars: Array<{ id: string; width: number; muted: boolean }>;
    qrCodeUrl: string;
    variant: 'horizontal' | 'vertical';
    isUsingFallbackDeparture: boolean;
}> = ({ ticket, barcodeBars, qrCodeUrl, variant, isUsingFallbackDeparture }) => {
    const isVertical = variant === 'vertical';
    const departureCode = ticket.departureAirport.iataCode || ticket.departureAirport.ident;
    const arrivalCode = ticket.arrivalAirport.iataCode || ticket.arrivalAirport.ident;
    const footerStatusLabel = isUsingFallbackDeparture ? 'BER default' : 'Live airport';

    if (isVertical) {
        return (
            <div className={cn('select-none overflow-hidden rounded-[16px] border border-border bg-[linear-gradient(180deg,#f7f4eb_0%,#fcfbf7_100%)] dark:bg-[linear-gradient(180deg,var(--card)_0%,var(--background)_100%)]', TICKET_CARD_SHADOW)}>
                <div className="h-2.5 bg-[linear-gradient(90deg,#0f172a_0%,#334155_100%)]" />
                <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Vertical style</div>
                            <div className="font-heading mt-2 truncate text-xl font-black tracking-[-0.04em] text-foreground">{ticket.airlineName}</div>
                        </div>
                        <div className="rounded-full border border-border bg-card px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {ticket.flightNumber}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">From</div>
                            <div className="font-heading mt-1 text-[clamp(3.4rem,14vw,4.8rem)] font-black leading-none tracking-[-0.09em] text-foreground">
                                {departureCode}
                            </div>
                            <div className="mt-2 truncate text-sm font-medium text-muted-foreground" title={formatAirportTicketLocationLabel(ticket.departureAirport)}>
                                {formatAirportTicketLocationLabel(ticket.departureAirport)}
                            </div>
                        </div>

                        <TicketRouteLine vertical />

                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">To</div>
                            <div className="font-heading mt-1 text-[clamp(3.4rem,14vw,4.8rem)] font-black leading-none tracking-[-0.09em] text-foreground">
                                {arrivalCode}
                            </div>
                            <div className="mt-2 truncate text-sm font-medium text-muted-foreground" title={formatAirportTicketLocationLabel(ticket.arrivalAirport)}>
                                {formatAirportTicketLocationLabel(ticket.arrivalAirport)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                        <TicketMetaPill label="Passenger" value={ticket.passengerName} />
                        <TicketMetaPill label="Date" value={ticket.departureDateLabel} />
                        <TicketMetaPill label="Gate" value={ticket.gate} />
                        <TicketMetaPill label="Seat" value={ticket.seat} />
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_102px] gap-3">
                        <TicketBarcode bars={barcodeBars} />
                        <TicketQrBadge qrCodeUrl={qrCodeUrl} />
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{ticket.departureTimeLabel} → {ticket.arrivalTimeLabel}</span>
                        <span>{footerStatusLabel}</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('select-none overflow-hidden rounded-[16px] border border-border bg-[linear-gradient(180deg,#f7f4eb_0%,#fcfbf7_100%)] dark:bg-[linear-gradient(180deg,var(--card)_0%,var(--background)_100%)]', TICKET_CARD_SHADOW)}>
            <div className="flex items-center justify-between gap-3 border-b border-border bg-[linear-gradient(90deg,#0f172a_0%,#334155_100%)] px-5 py-3 text-white">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">Digital Boarding Pass</div>
                    <div className="font-heading mt-1 truncate text-xl font-black tracking-[-0.04em]">{ticket.airlineName}</div>
                </div>
                <div className="rounded-full border border-white/15 bg-card/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    {ticket.flightNumber}
                </div>
            </div>

            <div className="space-y-5 p-5">
                <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)]">
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Departure</div>
                        <div className="font-heading mt-2 text-[clamp(3.1rem,9vw,5rem)] font-black leading-none tracking-[-0.09em] text-foreground">
                            {departureCode}
                        </div>
                        <div className="mt-2 truncate text-base font-medium text-muted-foreground" title={formatAirportTicketLocationLabel(ticket.departureAirport)}>
                            {formatAirportTicketLocationLabel(ticket.departureAirport)}
                        </div>
                    </div>

                    <TicketRouteLine />

                    <div className="min-w-0 text-start md:text-end">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Arrival</div>
                        <div className="font-heading mt-2 text-[clamp(3.1rem,9vw,5rem)] font-black leading-none tracking-[-0.09em] text-foreground">
                            {arrivalCode}
                        </div>
                        <div className="mt-2 truncate text-base font-medium text-muted-foreground" title={formatAirportTicketLocationLabel(ticket.arrivalAirport)}>
                            {formatAirportTicketLocationLabel(ticket.arrivalAirport)}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
                    <TicketMetaPill label="Passenger" value={ticket.passengerName} />
                    <TicketMetaPill label="Date" value={ticket.departureDateLabel} />
                    <TicketMetaPill label="Gate" value={ticket.gate} />
                    <TicketMetaPill label="Seat" value={ticket.seat} />
                </div>

                <div className="grid gap-3 border-t border-border pt-5 md:grid-cols-[minmax(0,1fr)_112px]">
                    <TicketBarcode bars={barcodeBars} />
                    <TicketQrBadge qrCodeUrl={qrCodeUrl} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{ticket.departureTimeLabel} → {ticket.arrivalTimeLabel}</span>
                    <span>{ticket.durationLabel}</span>
                    <span>{footerStatusLabel}</span>
                </div>
            </div>
        </div>
    );
};


export const AdminAirportTicketLab: React.FC<{
    catalogAirports: AirportReference[];
    origin: { label: string } | null;
    nearbyResult: NearbyAirportsResponse | null;
    /** Switches to the nearby tester, where the departure origin is chosen. */
    onChangeOrigin?: () => void;
}> = ({ catalogAirports, origin, nearbyResult, onChangeOrigin }) => {
    const [passengerName, setPassengerName] = useState('Alex Morgan');
    const [cabinClass, setCabinClass] = useState<FakeAirportTicketCabinClass>('economy');
    const [selectedDepartureIdent, setSelectedDepartureIdent] = useState<string>('');
    const [selectedDestinationIdent, setSelectedDestinationIdent] = useState<string>('');
    const [departureDate, setDepartureDate] = useState(() => {
        const next = new Date();
        next.setDate(next.getDate() + 14);
        return next.toISOString().slice(0, 10);
    });

    const fallbackDepartureOption = useMemo(() => {
        if (nearbyResult) return null;
        const berlinAirport = catalogAirports.find((airport) => airport.iataCode === 'BER' && airport.isCommercial)
            || catalogAirports.find((airport) => airport.ident === 'EDDB' && airport.isCommercial)
            || null;
        return berlinAirport ? {
            airport: berlinAirport,
            airportAccessDistanceKm: null,
            isFallback: true,
        } : null;
    }, [catalogAirports, nearbyResult]);

    const departureOptions = useMemo(
        () => {
            const nearbyOptions = (nearbyResult?.airports || []).map((entry) => ({
                airport: entry.airport,
                airportAccessDistanceKm: entry.airDistanceKm,
                isFallback: false,
            }));
            if (nearbyOptions.length > 0) return nearbyOptions;
            return fallbackDepartureOption ? [fallbackDepartureOption] : [];
        },
        [fallbackDepartureOption, nearbyResult],
    );

    const selectedDeparture = useMemo(
        () => departureOptions.find((entry) => entry.airport.ident === selectedDepartureIdent) || departureOptions[0] || null,
        [departureOptions, selectedDepartureIdent],
    );

    const destinationOptions = useMemo(() => {
        const excludedIdent = selectedDeparture?.airport.ident || null;
        const commercialOptions = catalogAirports.filter((airport) => (
            airport.isCommercial
            && airport.ident !== excludedIdent
            && airport.iataCode
            && (airport.commercialServiceTier === 'major' || airport.commercialServiceTier === 'regional')
        ));
        const byIdent = new Map<string, AirportReference>();
        commercialOptions.forEach((airport) => {
            byIdent.set(airport.ident, airport);
        });

        const prioritized: AirportReference[] = [];
        TICKET_DESTINATION_PRIORITY.forEach((iataCode) => {
            const match = commercialOptions.find((airport) => airport.iataCode === iataCode);
            if (match && !prioritized.some((airport) => airport.ident === match.ident)) {
                prioritized.push(match);
            }
        });

        commercialOptions.forEach((airport) => {
            if (!prioritized.some((entry) => entry.ident === airport.ident)) {
                prioritized.push(airport);
            }
        });

        return prioritized.slice(0, 16);
    }, [catalogAirports, selectedDeparture?.airport.ident]);

    const selectedDestination = useMemo(
        () => destinationOptions.find((airport) => airport.ident === selectedDestinationIdent) || destinationOptions[0] || null,
        [destinationOptions, selectedDestinationIdent],
    );

    const ticket = useMemo(() => {
        if (!selectedDeparture || !selectedDestination) return null;
        return buildFakeAirportTicket({
            passengerName,
            departureAirport: selectedDeparture.airport,
            arrivalAirport: selectedDestination,
            departureDate,
            cabinClass,
            originLabel: origin?.label || null,
            airportAccessDistanceKm: selectedDeparture.airportAccessDistanceKm,
        });
    }, [cabinClass, departureDate, origin?.label, passengerName, selectedDeparture, selectedDestination]);

    const ticketBarcodeBars = useMemo(
        () => (ticket ? buildTicketBarcodeBars(`${ticket.ticketNumber}${ticket.bookingReference}${ticket.flightNumber}${ticket.seat}`) : []),
        [ticket],
    );
    const ticketQrCodeUrl = useMemo(
        () => buildTicketQrCodeUrl(typeof window !== 'undefined' ? window.location.origin : TICKET_QR_FALLBACK_DOMAIN),
        [],
    );

    const isUsingFallbackDeparture = Boolean(selectedDeparture?.isFallback);

    return (
        <AdminSurfaceCard className="flex flex-col gap-4">
            <AdminSectionHeader
                title="Ticket lab"
                description="A boarding-pass mock-up built from the nearest commercial airport, to judge the future ticket against real airport data."
                actions={(
                    <>
                        {ticket && <Badge variant="secondary">{formatCabinClassLabel(ticket.cabinClass)} preview</Badge>}
                        {onChangeOrigin && (
                            <Button type="button" variant="outline" size="sm" onClick={onChangeOrigin}>
                                <MapPin /> Change origin
                            </Button>
                        )}
                    </>
                )}
            />

            {!nearbyResult && fallbackDepartureOption && (
                <Alert variant="warning">
                    <WarningCircle weight="fill" />
                    <AlertTitle>Testing fallback active</AlertTitle>
                    <AlertDescription>
                        <p>Using Berlin Brandenburg Airport (BER) as the default ticket departure until you run a nearby-airport lookup.</p>
                    </AlertDescription>
                </Alert>
            )}

            {!nearbyResult && !fallbackDepartureOption && (
                <AdminEmptyState
                    title="No departure airport yet"
                    description="Run a nearby-airport lookup first, then this lab will use the closest commercial airport as the departure side of the fake ticket."
                />
            )}

            {ticket && (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,1.08fr)]">
                    <div className="flex min-w-0 flex-col gap-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="admin-airports-ticket-passenger" className={ADMIN_FIELD_LABEL_CLASS}>Passenger name</label>
                                <Input
                                    id="admin-airports-ticket-passenger"
                                    value={passengerName}
                                    onChange={(event) => setPassengerName(event.target.value)}
                                    placeholder="Alex Morgan"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="admin-airports-ticket-date" className={ADMIN_FIELD_LABEL_CLASS}>Departure date</label>
                                <Input
                                    id="admin-airports-ticket-date"
                                    type="date"
                                    value={departureDate}
                                    onChange={(event) => setDepartureDate(event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <div id="admin-airports-ticket-departure-label" className={ADMIN_FIELD_LABEL_CLASS}>Departure airport</div>
                                <Select value={selectedDeparture?.airport.ident || ''} onValueChange={setSelectedDepartureIdent}>
                                    <SelectTrigger aria-labelledby="admin-airports-ticket-departure-label" className="w-full">
                                        <SelectValue placeholder="Choose a nearby airport" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departureOptions.map((entry) => (
                                            <SelectItem key={entry.airport.ident} value={entry.airport.ident}>
                                                {(entry.airport.iataCode || entry.airport.ident)} · {entry.airport.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <div id="admin-airports-ticket-destination-label" className={ADMIN_FIELD_LABEL_CLASS}>Destination airport</div>
                                <Select value={selectedDestination?.ident || ''} onValueChange={setSelectedDestinationIdent}>
                                    <SelectTrigger aria-labelledby="admin-airports-ticket-destination-label" className="w-full">
                                        <SelectValue placeholder="Choose a destination hub" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationOptions.map((airport) => (
                                            <SelectItem key={airport.ident} value={airport.ident}>
                                                {(airport.iataCode || airport.ident)} · {airport.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div id="admin-airports-ticket-cabin-label" className={ADMIN_FIELD_LABEL_CLASS}>Cabin class</div>
                            <Select value={cabinClass} onValueChange={(value) => setCabinClass(value as FakeAirportTicketCabinClass)}>
                                <SelectTrigger aria-labelledby="admin-airports-ticket-cabin-label" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TICKET_CABIN_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {selectedDeparture && (
                            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                                <div className="text-xs font-medium text-muted-foreground">Departure context</div>
                                <div className="mt-1">
                                    {selectedDeparture.airport.name} · {selectedDeparture.airport.municipality || 'Unknown city'}
                                    {selectedDeparture.airportAccessDistanceKm !== null ? ` · ${formatDistance(selectedDeparture.airportAccessDistanceKm)}` : ''}
                                </div>
                                {isUsingFallbackDeparture ? (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        BER stays available as a reliable test fallback until a nearby lookup runs.
                                    </div>
                                ) : origin && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Based on {origin.label}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <div className={ADMIN_FIELD_LABEL_CLASS}>Horizontal style</div>
                            <AirportTicketPreviewCard
                                ticket={ticket}
                                barcodeBars={ticketBarcodeBars}
                                qrCodeUrl={ticketQrCodeUrl}
                                variant="horizontal"
                                isUsingFallbackDeparture={isUsingFallbackDeparture}
                            />
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
                            <div className="h-fit rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-medium text-foreground">
                                        {isUsingFallbackDeparture ? 'Testing airport:' : 'Closest airport:'}
                                    </span>
                                    <span>{ticket.departureAirport.name}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{ticket.durationLabel}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{formatDistance(ticket.routeDistanceKm)}</span>
                                    {ticket.airportAccessDistanceKm !== null && (
                                        <>
                                            <span aria-hidden="true">·</span>
                                            <span className="tabular-nums">{formatDistance(ticket.airportAccessDistanceKm)} from origin</span>
                                        </>
                                    )}
                                </div>
                                {isUsingFallbackDeparture ? (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        BER fallback stays visible until you run a nearby-airport lookup
                                    </div>
                                ) : ticket.originLabel && (
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Based on {ticket.originLabel}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <div className={ADMIN_FIELD_LABEL_CLASS}>Vertical style</div>
                                <AirportTicketPreviewCard
                                    ticket={ticket}
                                    barcodeBars={ticketBarcodeBars}
                                    qrCodeUrl={ticketQrCodeUrl}
                                    variant="vertical"
                                    isUsingFallbackDeparture={isUsingFallbackDeparture}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminSurfaceCard>
    );
};

