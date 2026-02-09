import { ITrip } from '../../types';

// Re-export validation
export { validateTripSchema } from './_validation';

// Re-export all templates and factories
export { THAILAND_TEMPLATE, createThailandTrip } from './thailand';
export { JAPAN_TEMPLATE, createJapanTrip } from './japan';
export { ITALY_TEMPLATE, createItalyTrip } from './italy';
export { PORTUGAL_TEMPLATE, createPortugalTrip } from './portugal';
export { PERU_TEMPLATE, createPeruTrip } from './peru';
export { NEW_ZEALAND_TEMPLATE, createNewZealandTrip } from './newZealand';
export { MOROCCO_TEMPLATE, createMoroccoTrip } from './morocco';
export { ICELAND_TEMPLATE, createIcelandTrip } from './iceland';

// Import templates and factories for the maps
import { THAILAND_TEMPLATE, createThailandTrip } from './thailand';
import { JAPAN_TEMPLATE, createJapanTrip } from './japan';
import { ITALY_TEMPLATE, createItalyTrip } from './italy';
import { PORTUGAL_TEMPLATE, createPortugalTrip } from './portugal';
import { PERU_TEMPLATE, createPeruTrip } from './peru';
import { NEW_ZEALAND_TEMPLATE, createNewZealandTrip } from './newZealand';
import { MOROCCO_TEMPLATE, createMoroccoTrip } from './morocco';
import { ICELAND_TEMPLATE, createIcelandTrip } from './iceland';

/** Map keyed by exampleTripCards id → template */
export const TRIP_TEMPLATES: Record<string, Partial<ITrip>> = {
    'thailand-islands': THAILAND_TEMPLATE,
    'japan-spring': JAPAN_TEMPLATE,
    'italy-classic': ITALY_TEMPLATE,
    'portugal-coast': PORTUGAL_TEMPLATE,
    'peru-adventure': PERU_TEMPLATE,
    'new-zealand-wild': NEW_ZEALAND_TEMPLATE,
    'morocco-medina': MOROCCO_TEMPLATE,
    'iceland-ring': ICELAND_TEMPLATE,
};

/** Map keyed by exampleTripCards id → factory function that creates a full ITrip */
export const TRIP_FACTORIES: Record<string, (startDate: string) => ITrip> = {
    'thailand-islands': createThailandTrip,
    'japan-spring': createJapanTrip,
    'italy-classic': createItalyTrip,
    'portugal-coast': createPortugalTrip,
    'peru-adventure': createPeruTrip,
    'new-zealand-wild': createNewZealandTrip,
    'morocco-medina': createMoroccoTrip,
    'iceland-ring': createIcelandTrip,
};
