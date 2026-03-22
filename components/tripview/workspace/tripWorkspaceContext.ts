import type { TripWorkspaceContextSelection } from '../../../types';
import type {
    TripWorkspaceCityGuide,
    TripWorkspaceCountryGuide,
    TripWorkspaceDemoDataset,
} from './tripWorkspaceDemoData';

export interface TripWorkspaceContextSnapshot {
    activeCountry: TripWorkspaceCountryGuide | null;
    activeCity: TripWorkspaceCityGuide | null;
    countryCities: TripWorkspaceCityGuide[];
    hasMultipleCountries: boolean;
}

export const resolveTripWorkspaceContextSnapshot = (
    dataset: TripWorkspaceDemoDataset,
    selection: TripWorkspaceContextSelection,
): TripWorkspaceContextSnapshot => {
    const activeCountry = dataset.countries.find((country) => country.code === selection.countryCode)
        ?? dataset.countries[0]
        ?? null;
    const countryCities = activeCountry
        ? dataset.cities.filter((city) => city.countryCode === activeCountry.code)
        : dataset.cities;
    const activeCity = countryCities.find((city) => city.id === selection.cityGuideId)
        ?? countryCities[0]
        ?? dataset.cities[0]
        ?? null;

    return {
        activeCountry,
        activeCity,
        countryCities,
        hasMultipleCountries: dataset.countries.length > 1,
    };
};

export const filterTripWorkspaceEntriesBySelection = <T extends { countryCode?: string; cityId?: string }>(
    entries: T[],
    selection: TripWorkspaceContextSelection,
    mode: 'trip' | 'country' | 'city' = 'city',
): T[] => {
    if (mode === 'trip') return entries;

    return entries.filter((entry) => {
        if (mode === 'country') {
            return !entry.countryCode || entry.countryCode === selection.countryCode;
        }

        const matchesCountry = !entry.countryCode || entry.countryCode === selection.countryCode;
        const matchesCity = !entry.cityId || entry.cityId === selection.cityGuideId;
        return matchesCountry && matchesCity;
    });
};
