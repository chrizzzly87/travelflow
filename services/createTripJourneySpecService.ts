import type { CreateTripPreferenceSignals } from '../shared/createTripPreferences';
import {
  buildJourneySpecFromLegacyCreateTrip,
  type JourneyCreator,
  type JourneyPace,
  type JourneySpec,
} from '../shared/journeySpec';
import { getDestinationOptionByName } from './destinationService';

export interface BuildCreateTripJourneySpecInput {
  destinationNames: string[];
  startDate?: string;
  endDate?: string;
  durationDays: number;
  roundTrip?: boolean;
  pace?: string;
  flexibleMonths?: number[];
  preferences?: CreateTripPreferenceSignals;
  createdFrom: Extract<JourneyCreator, 'classic' | 'wizard_v3'>;
}

const normalizeJourneyPace = (value?: string): JourneyPace => {
  const normalized = value?.trim().toLocaleLowerCase();
  if (normalized === 'relaxed') return 'relaxed';
  if (normalized === 'fast' || normalized === 'full') return 'full';
  return 'balanced';
};

const resolveCountryScopes = (
  destinationNames: string[],
): Array<{ name: string; code: string }> => {
  const countriesByCode = new Map<string, { name: string; code: string }>();

  destinationNames.forEach((destinationName) => {
    const destination = getDestinationOptionByName(destinationName);
    if (!destination) return;
    const code = (destination.kind === 'island'
      ? destination.parentCountryCode
      : destination.code)?.trim().toUpperCase();
    const name = (destination.kind === 'island'
      ? destination.parentCountryName
      : destination.name)?.trim();
    if (!code || code.length !== 2 || !name || countriesByCode.has(code)) return;
    countriesByCode.set(code, { name, code });
  });

  return Array.from(countriesByCode.values());
};

export const buildJourneySpecFromCreateTripIntent = (
  input: BuildCreateTripJourneySpecInput,
): JourneySpec => {
  const countries = resolveCountryScopes(input.destinationNames);
  if (countries.length === 0) {
    throw new Error('JourneySpec requires at least one recognized destination country.');
  }

  return buildJourneySpecFromLegacyCreateTrip({
    countries,
    startDate: input.startDate,
    endDate: input.endDate,
    durationDays: input.durationDays,
    roundTrip: input.roundTrip,
    pace: normalizeJourneyPace(input.pace),
    flexibleMonths: input.flexibleMonths,
    preferences: input.preferences,
    createdFrom: input.createdFrom,
  });
};
