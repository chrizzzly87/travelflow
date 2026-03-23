import type { ICoordinates } from '../../../types';
import type {
    TripWorkspaceCityMapLayer,
    TripWorkspaceCityNeighborhood,
    TripWorkspaceCityStay,
    TripWorkspaceMapPercentPoint,
} from './tripWorkspaceDemoData';

export const TRIP_WORKSPACE_NEIGHBORHOOD_RADIUS_METERS: Record<TripWorkspaceCityNeighborhood['mapRadius'], number> = {
    sm: 1200,
    md: 1800,
    lg: 2500,
};

const HORIZONTAL_SPAN_KM = 7.6;
const VERTICAL_SPAN_KM = 6.2;
const MIN_LONGITUDE_DIVISOR = 0.0001;

export interface TripWorkspacePlacesMapGeometry {
    neighborhoods: Array<TripWorkspaceCityNeighborhood & { center: ICoordinates; radiusMeters: number }>;
    stays: Array<TripWorkspaceCityStay & { coordinate: ICoordinates }>;
    focusPath: ICoordinates[];
    calloutCoordinate: ICoordinates | null;
}

export function buildTripWorkspacePlacesFitBoundsCoordinates(
    geometry: TripWorkspacePlacesMapGeometry,
): ICoordinates[] {
    const boundsCoordinates: ICoordinates[] = [];

    geometry.neighborhoods.forEach((neighborhood) => {
        const radiusKm = neighborhood.radiusMeters / 1000;
        boundsCoordinates.push(
            neighborhood.center,
            offsetCoordinateByKilometers(neighborhood.center, 0, radiusKm),
            offsetCoordinateByKilometers(neighborhood.center, 0, -radiusKm),
            offsetCoordinateByKilometers(neighborhood.center, radiusKm, 0),
            offsetCoordinateByKilometers(neighborhood.center, -radiusKm, 0),
        );
    });

    geometry.stays.forEach((stay) => {
        boundsCoordinates.push(stay.coordinate);
    });

    geometry.focusPath.forEach((point) => {
        boundsCoordinates.push(point);
    });

    if (geometry.calloutCoordinate) {
        boundsCoordinates.push(geometry.calloutCoordinate);
    }

    return boundsCoordinates;
}

export function offsetCoordinateByKilometers(
    origin: ICoordinates,
    eastWestKm: number,
    northSouthKm: number,
): ICoordinates {
    const latitudeRadians = (origin.lat * Math.PI) / 180;
    const latitudeDelta = northSouthKm / 110.574;
    const longitudeDivisor = Math.max(111.32 * Math.cos(latitudeRadians), MIN_LONGITUDE_DIVISOR);
    const longitudeDelta = eastWestKm / longitudeDivisor;

    return {
        lat: origin.lat + latitudeDelta,
        lng: origin.lng + longitudeDelta,
    };
}

export function projectPercentPointToCoordinate(
    origin: ICoordinates,
    point: TripWorkspaceMapPercentPoint,
): ICoordinates {
    const eastWestKm = ((point.x - 50) / 50) * HORIZONTAL_SPAN_KM;
    const northSouthKm = ((50 - point.y) / 50) * VERTICAL_SPAN_KM;
    return offsetCoordinateByKilometers(origin, eastWestKm, northSouthKm);
}

export function buildTripWorkspacePlacesMapGeometry(params: {
    origin: ICoordinates | null;
    visibleNeighborhoods: TripWorkspaceCityNeighborhood[];
    visibleStays: TripWorkspaceCityStay[];
    activeLayer: TripWorkspaceCityMapLayer | null;
}): TripWorkspacePlacesMapGeometry {
    const { origin, visibleNeighborhoods, visibleStays, activeLayer } = params;

    if (!origin) {
        return {
            neighborhoods: [],
            stays: [],
            focusPath: [],
            calloutCoordinate: null,
        };
    }

    return {
        neighborhoods: visibleNeighborhoods.map((neighborhood) => ({
            ...neighborhood,
            center: projectPercentPointToCoordinate(origin, neighborhood.mapPosition),
            radiusMeters: TRIP_WORKSPACE_NEIGHBORHOOD_RADIUS_METERS[neighborhood.mapRadius],
        })),
        stays: visibleStays.map((stay) => ({
            ...stay,
            coordinate: projectPercentPointToCoordinate(origin, stay.mapPosition),
        })),
        focusPath: (activeLayer?.focusPath ?? []).map((point) => projectPercentPointToCoordinate(origin, point)),
        calloutCoordinate: activeLayer
            ? projectPercentPointToCoordinate(origin, activeLayer.callout.position)
            : null,
    };
}
