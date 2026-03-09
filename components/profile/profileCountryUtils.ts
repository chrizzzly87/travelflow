import type { ITrip } from '../../types';
import { COUNTRIES } from '../../utils';

export interface VisitedCountry {
  code: string | null;
  name: string;
}

const normalizeCountryToken = (value: string): string => value
  .trim()
  .toLocaleLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const COUNTRY_CODE_BY_NAME = new Map(
  COUNTRIES.map((country) => [normalizeCountryToken(country.name), country.code] as const)
);

const getCountryCode = (name: string): string | null => {
  const normalized = normalizeCountryToken(name);
  if (!normalized) return null;
  return COUNTRY_CODE_BY_NAME.get(normalized) ?? null;
};

export const collectVisitedCountries = (trips: ITrip[]): VisitedCountry[] => {
  const countries = new Map<string, VisitedCountry>();

  trips.forEach((trip) => {
    trip.items.forEach((item) => {
      if (item.type !== 'city') return;
      const rawName = typeof item.countryName === 'string' ? item.countryName.trim() : '';
      if (!rawName) return;
      const key = normalizeCountryToken(rawName);
      if (!key || countries.has(key)) return;
      countries.set(key, {
        name: rawName,
        code: getCountryCode(rawName),
      });
    });
  });

  return Array.from(countries.values()).sort((a, b) => a.name.localeCompare(b.name));
};
