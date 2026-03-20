export type GlobeLocation = [number, number];

export interface GlobeProjectionConfig {
    height: number;
    markerElevation: number;
    offset: [number, number];
    phi: number;
    scale: number;
    theta: number;
    width: number;
}

export interface ProjectedGlobePoint {
    depth: number;
    visible: boolean;
    visibility: number;
    x: number;
    y: number;
}

const GLOBE_RADIUS = 0.8;
const MAX_TILT = 0.32;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeAngle = (value: number): number => {
    let angle = value;
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
};

const globeLocationToVector = ([latitude, longitude]: GlobeLocation) => {
    const lat = latitude * (Math.PI / 180);
    const lon = longitude * (Math.PI / 180);
    const cosLat = Math.cos(lat);

    return [
        cosLat * Math.cos(lon),
        Math.sin(lat),
        -cosLat * Math.sin(lon),
    ] as const;
};

export const projectGlobeLocation = (
    location: GlobeLocation,
    config: GlobeProjectionConfig,
): ProjectedGlobePoint => {
    const vector = globeLocationToVector(location);
    const radius = GLOBE_RADIUS + config.markerElevation;
    const x = vector[0] * radius;
    const y = vector[1] * radius;
    const z = vector[2] * radius;

    const cosTheta = Math.cos(config.theta);
    const cosPhi = Math.cos(config.phi);
    const sinTheta = Math.sin(config.theta);
    const sinPhi = Math.sin(config.phi);

    const projectedX = (cosPhi * x) + (sinPhi * z);
    const projectedY = (sinPhi * sinTheta * x) + (cosTheta * y) - (cosPhi * sinTheta * z);
    const depth = (-sinPhi * cosTheta * x) + (sinTheta * y) + (cosPhi * cosTheta * z);
    const visible = depth >= 0 || ((projectedX * projectedX) + (projectedY * projectedY) >= 0.64);

    return {
        x: (((projectedX / (config.width / config.height)) * config.scale) + ((config.offset[0] * config.scale) / config.width) + 1) * 0.5 * config.width,
        y: ((-(projectedY * config.scale)) + ((config.offset[1] * config.scale) / config.height) + 1) * 0.5 * config.height,
        depth,
        visible,
        visibility: visible ? 1 : 0,
    };
};

export const getGlobeRotationForLocation = (location: GlobeLocation) => {
    const [latitude, longitude] = location;
    const latitudeRadians = latitude * (Math.PI / 180);
    const longitudeRadians = longitude * (Math.PI / 180);

    return {
        phi: normalizeAngle((-Math.PI / 2) - longitudeRadians),
        theta: clamp(latitudeRadians * 0.24, -MAX_TILT, MAX_TILT),
    };
};
