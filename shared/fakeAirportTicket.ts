import { computeAirDistanceKm, type AirportReference } from './airportReference';

export type FakeAirportTicketCabinClass = 'economy' | 'business' | 'first';

export interface FakeAirportTicket {
  passengerName: string;
  airlineName: string;
  flightNumber: string;
  bookingReference: string;
  ticketNumber: string;
  cabinClass: FakeAirportTicketCabinClass;
  boardingGroup: string;
  gate: string;
  seat: string;
  terminal: string;
  departureDateLabel: string;
  boardingTimeLabel: string;
  departureTimeLabel: string;
  arrivalTimeLabel: string;
  durationLabel: string;
  routeDistanceKm: number;
  airportAccessDistanceKm: number | null;
  originLabel: string | null;
  departureAirport: AirportReference;
  arrivalAirport: AirportReference;
}

export interface BuildFakeAirportTicketInput {
  passengerName: string;
  departureAirport: AirportReference;
  arrivalAirport: AirportReference;
  departureDate: string;
  cabinClass: FakeAirportTicketCabinClass;
  originLabel?: string | null;
  airportAccessDistanceKm?: number | null;
}

const AIRLINE_NAME = 'TravelFlow Air';
const DAY_IN_MINUTES = 24 * 60;
const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BOARDING_GROUPS: Record<FakeAirportTicketCabinClass, string[]> = {
  economy: ['Group 3', 'Group 4', 'Group 5'],
  business: ['Group 2', 'Priority'],
  first: ['Priority', 'First'],
};

const clampMinuteOfDay = (value: number): number => {
  const normalized = value % DAY_IN_MINUTES;
  return normalized >= 0 ? normalized : normalized + DAY_IN_MINUTES;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pick = <Value,>(values: Value[], seed: number): Value => values[seed % values.length];

const pad = (value: number): string => value.toString().padStart(2, '0');

const formatTime = (minuteOfDay: number): string => {
  const normalized = clampMinuteOfDay(minuteOfDay);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const formatDateLabel = (value: string): string => {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
};

const createBookingReference = (seed: number): string => {
  return (seed.toString(36).toUpperCase() + 'TFAIR').replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(6, '7');
};

const createTicketNumber = (seed: number): string => {
  const body = String(1000000000 + (seed % 9000000000));
  return `016-${body.slice(0, 4)}-${body.slice(4, 10)}`;
};

const createFlightNumber = (
  departureAirport: AirportReference,
  arrivalAirport: AirportReference,
  seed: number,
): string => {
  const codeSeed = (departureAirport.iataCode || departureAirport.icaoCode || departureAirport.ident || 'TF').slice(0, 2);
  const airlineCode = codeSeed.padEnd(2, 'T');
  return `${airlineCode}${100 + (seed % 900)}`;
};

const createSeat = (seed: number, cabinClass: FakeAirportTicketCabinClass): string => {
  const rowBase = cabinClass === 'first' ? 1 : cabinClass === 'business' ? 4 : 18;
  const rowRange = cabinClass === 'first' ? 4 : cabinClass === 'business' ? 12 : 28;
  const row = rowBase + (seed % rowRange);
  const letter = pick(SEAT_LETTERS, seed + 7);
  return `${row}${letter}`;
};

const createTerminal = (seed: number): string => `${1 + (seed % 4)}`;

const createGate = (seed: number): string => `${pick(['A', 'B', 'C', 'D', 'E'], seed)}${1 + (seed % 28)}`;

const computeDurationMinutes = (
  departureAirport: AirportReference,
  arrivalAirport: AirportReference,
  seed: number,
): number => {
  const routeDistanceKm = computeAirDistanceKm(
    { lat: departureAirport.latitude, lng: departureAirport.longitude },
    { lat: arrivalAirport.latitude, lng: arrivalAirport.longitude },
  );
  const flightMinutes = Math.max(70, Math.round((routeDistanceKm / 760) * 60) + 42);
  return flightMinutes + (seed % 16);
};

export const buildFakeAirportTicket = ({
  passengerName,
  departureAirport,
  arrivalAirport,
  departureDate,
  cabinClass,
  originLabel = null,
  airportAccessDistanceKm = null,
}: BuildFakeAirportTicketInput): FakeAirportTicket => {
  const seed = hashString([
    passengerName.trim().toUpperCase(),
    departureAirport.ident,
    arrivalAirport.ident,
    departureDate,
    cabinClass,
  ].join('|'));
  const routeDistanceKm = computeAirDistanceKm(
    { lat: departureAirport.latitude, lng: departureAirport.longitude },
    { lat: arrivalAirport.latitude, lng: arrivalAirport.longitude },
  );
  const durationMinutes = computeDurationMinutes(departureAirport, arrivalAirport, seed);
  const departureMinute = 360 + (seed % 780);
  const boardingLeadMinutes = cabinClass === 'first' ? 55 : cabinClass === 'business' ? 45 : 35;
  const boardingMinute = departureMinute - boardingLeadMinutes;
  const arrivalMinute = departureMinute + durationMinutes;
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainderMinutes = durationMinutes % 60;

  return {
    passengerName: passengerName.trim() || 'Traveler',
    airlineName: AIRLINE_NAME,
    flightNumber: createFlightNumber(departureAirport, arrivalAirport, seed),
    bookingReference: createBookingReference(seed),
    ticketNumber: createTicketNumber(seed),
    cabinClass,
    boardingGroup: pick(BOARDING_GROUPS[cabinClass], seed + 11),
    gate: createGate(seed + 17),
    seat: createSeat(seed + 23, cabinClass),
    terminal: createTerminal(seed + 31),
    departureDateLabel: formatDateLabel(departureDate),
    boardingTimeLabel: formatTime(boardingMinute),
    departureTimeLabel: formatTime(departureMinute),
    arrivalTimeLabel: formatTime(arrivalMinute),
    durationLabel: `${durationHours}h ${pad(durationRemainderMinutes)}m`,
    routeDistanceKm: Number(routeDistanceKm.toFixed(1)),
    airportAccessDistanceKm: typeof airportAccessDistanceKm === 'number' && Number.isFinite(airportAccessDistanceKm)
      ? Number(airportAccessDistanceKm.toFixed(1))
      : null,
    originLabel: originLabel?.trim() || null,
    departureAirport,
    arrivalAirport,
  };
};
