import React from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SplitFlap, SPLIT_FLAP_CHARSET_ALPHA } from '../../ui/SplitFlap';
import type { AirportReference, NearbyAirportResult } from '../../../shared/airportReference';
import { fetchNearbyAirports } from '../../../services/nearbyAirportsService';
import { ensureRuntimeLocationLoaded } from '../../../services/runtimeLocationService';

const DEFAULT_AIRPORT_CODE = 'DXB';
const AIRPORT_LOOKUP_LIMIT = 5;
const DREAM_DESTINATION_CODES = ['CDG', 'HNL', 'JFK', 'LAX', 'CPT', 'CMB', 'BKK', 'SYD'] as const;
const DREAM_DESTINATION_ROTATION_MS = 2600;
const ORIGIN_SPLIT_FLAP_PROPS = {
    flipDuration: 500,
    drumSpeed: 125,
    maxSteps: 5,
    stagger: 150,
    easing: 'natural' as const,
};
const DESTINATION_SPLIT_FLAP_PROPS = {
    flipDuration: 500,
    drumSpeed: 95,
    maxSteps: 8,
    stagger: 150,
    easing: 'natural' as const,
};

type AirportVisualPhase = 'idle' | 'loading' | 'ready' | 'fallback';

interface AirportVisualState {
    city: string | null;
    country: string | null;
    resolvedCode: string;
    phase: AirportVisualPhase;
}

const hasFiniteCoordinates = (latitude: number | null, longitude: number | null): boolean => (
    typeof latitude === 'number'
    && typeof longitude === 'number'
    && Number.isFinite(latitude)
    && Number.isFinite(longitude)
);

const cleanAirportCode = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length === 3) return normalized;
    if (normalized.length > 3) return normalized.slice(-3);
    return null;
};

const pickBestAirport = (airports: NearbyAirportResult[]): AirportReference | null => {
    const airportWithIata = airports.find(({ airport }) => cleanAirportCode(airport.iataCode));
    return airportWithIata?.airport || airports[0]?.airport || null;
};

const getDisplayCode = (airport: AirportReference | null): string => (
    cleanAirportCode(airport?.iataCode)
    || cleanAirportCode(airport?.ident)
    || cleanAirportCode(airport?.icaoCode)
    || DEFAULT_AIRPORT_CODE
);

export const FeaturesAirportBentoVisual: React.FC<{
    shouldPrefetch: boolean;
    isActive: boolean;
}> = ({ shouldPrefetch, isActive }) => {
    const { t } = useTranslation('features');
    const [, startTransition] = React.useTransition();
    const [destinationIndex, setDestinationIndex] = React.useState(0);
    const [displayCode, setDisplayCode] = React.useState(DEFAULT_AIRPORT_CODE);
    const [hasRevealedOrigin, setHasRevealedOrigin] = React.useState(false);
    const [visualState, setVisualState] = React.useState<AirportVisualState>({
        city: null,
        country: null,
        resolvedCode: DEFAULT_AIRPORT_CODE,
        phase: 'idle',
    });
    const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
    const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

    React.useEffect(() => {
        const intervalId = window.setInterval(() => {
            startTransition(() => {
                setDestinationIndex((current) => (current + 1) % DREAM_DESTINATION_CODES.length);
            });
        }, DREAM_DESTINATION_ROTATION_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [startTransition]);

    React.useEffect(() => {
        if (!shouldPrefetch) return;

        let cancelled = false;

        startTransition(() => {
            setVisualState((current) => ({
                ...current,
                phase: 'loading',
            }));
        });

        const loadNearestAirport = async () => {
            const snapshot = await ensureRuntimeLocationLoaded();
            if (cancelled) return;

            const { city, countryName, latitude, longitude } = snapshot.location;
            const resolvedCity = typeof city === 'string' && city.trim() ? city.trim() : null;
            const resolvedCountry = typeof countryName === 'string' && countryName.trim() ? countryName.trim() : null;

            if (!hasFiniteCoordinates(latitude, longitude)) {
                startTransition(() => {
                    setVisualState({
                        city: resolvedCity,
                        country: resolvedCountry,
                        resolvedCode: DEFAULT_AIRPORT_CODE,
                        phase: 'fallback',
                    });
                });
                return;
            }

            try {
                let response = await fetchNearbyAirports({
                    lat: latitude,
                    lng: longitude,
                    limit: AIRPORT_LOOKUP_LIMIT,
                    minimumServiceTier: 'major',
                });
                if (cancelled) return;

                if (response.airports.length === 0) {
                    response = await fetchNearbyAirports({
                        lat: latitude,
                        lng: longitude,
                        limit: AIRPORT_LOOKUP_LIMIT,
                        minimumServiceTier: 'regional',
                    });
                    if (cancelled) return;
                }

                if (cancelled) return;

                const airport = pickBestAirport(response.airports);
                if (!airport) {
                    startTransition(() => {
                        setVisualState({
                            city: resolvedCity,
                            country: resolvedCountry,
                            resolvedCode: DEFAULT_AIRPORT_CODE,
                            phase: 'fallback',
                        });
                    });
                    return;
                }

                startTransition(() => {
                    setVisualState({
                        city: resolvedCity || airport.municipality || null,
                        country: resolvedCountry || airport.countryName || null,
                        resolvedCode: getDisplayCode(airport),
                        phase: 'ready',
                    });
                });
            } catch {
                if (cancelled) return;
                startTransition(() => {
                    setVisualState({
                        city: resolvedCity,
                        country: resolvedCountry,
                        resolvedCode: DEFAULT_AIRPORT_CODE,
                        phase: 'fallback',
                    });
                });
            }
        };

        void loadNearestAirport();

        return () => {
            cancelled = true;
        };
    }, [shouldPrefetch, startTransition]);

    React.useEffect(() => {
        if (!isActive) return;

        setHasRevealedOrigin(true);
        setDisplayCode((current) => (
            current === visualState.resolvedCode ? current : visualState.resolvedCode
        ));
    }, [isActive, visualState.resolvedCode]);

    const statusText = React.useMemo(() => {
        if (!hasRevealedOrigin) {
            return t('bento.airportCard.defaultStatus');
        }
        if (visualState.phase === 'ready') {
            if (visualState.city) {
                return t('bento.airportCard.readyCityStatus', {
                    city: visualState.city,
                });
            }
            if (visualState.country) {
                return t('bento.airportCard.readyCountryStatus', {
                    country: visualState.country,
                });
            }
            return t('bento.airportCard.fallbackStatus');
        }
        if (visualState.phase === 'loading') {
            return t('bento.airportCard.loadingStatus');
        }
        if (visualState.phase === 'fallback') {
            return t('bento.airportCard.fallbackStatus');
        }
        return t('bento.airportCard.defaultStatus');
    }, [hasRevealedOrigin, t, visualState.city, visualState.country, visualState.phase]);

    const destinationCode = DREAM_DESTINATION_CODES[destinationIndex];

    return (
        <div className="min-w-0 w-full select-none">
            <div
                data-testid="features-airport-route"
                className="flex w-full items-center justify-between gap-3 sm:gap-5 lg:justify-end"
            >
                <SplitFlap
                    value={displayCode}
                    length={3}
                    charset={SPLIT_FLAP_CHARSET_ALPHA}
                    size="lg"
                    theme="light"
                    surface="bare"
                    className="tracking-[0.08em] drop-shadow-[0_10px_18px_rgba(15,23,42,0.12)]"
                    {...ORIGIN_SPLIT_FLAP_PROPS}
                />
                <span className="flex shrink-0 items-center justify-center text-slate-400" aria-hidden="true">
                    <ArrowIcon size={24} weight="regular" />
                </span>
                <SplitFlap
                    value={destinationCode}
                    length={3}
                    charset={SPLIT_FLAP_CHARSET_ALPHA}
                    size="lg"
                    theme="light"
                    surface="bare"
                    className="tracking-[0.08em] drop-shadow-[0_10px_18px_rgba(15,23,42,0.12)]"
                    {...DESTINATION_SPLIT_FLAP_PROPS}
                />
            </div>

            <div className="mt-5 max-w-xl sm:mt-6">
                <p className="text-balance text-sm leading-relaxed text-slate-600">
                    {statusText}
                </p>
            </div>
        </div>
    );
};
