import { describe, expect, it } from 'vitest';
import {
    getGlobeRotationForLocation,
    projectGlobeLocation,
    type GlobeProjectionConfig,
} from '../../../components/marketing/features/globeProjection';

const projectionConfig: GlobeProjectionConfig = {
    width: 520,
    height: 520,
    phi: -1.42,
    theta: 0.14,
    scale: 0.94,
    offset: [0, 18],
    markerElevation: 0.1,
};

describe('projectGlobeLocation', () => {
    it('starts with Europe-facing markers more visible than East Asia markers', () => {
        const lisbon = projectGlobeLocation([38.7223, -9.1393], projectionConfig);
        const tokyo = projectGlobeLocation([35.6762, 139.6503], projectionConfig);

        expect(lisbon.visible).toBe(true);
        expect(tokyo.visible).toBe(false);
        expect(lisbon.depth).toBeGreaterThan(tokyo.depth);
    });

    it('fades a marker out when the globe rotates it behind the sphere', () => {
        const front = projectGlobeLocation([38.7223, -9.1393], projectionConfig);
        const back = projectGlobeLocation([38.7223, -9.1393], {
            ...projectionConfig,
            phi: Math.PI + projectionConfig.phi,
        });

        expect(front.visible).toBe(true);
        expect(back.visible).toBe(false);
        expect(front.depth).toBeGreaterThan(0);
        expect(back.depth).toBeLessThan(0);
    });

    it('computes an initial rotation that centers Europe-facing origins on the globe', () => {
        const hamburgRotation = getGlobeRotationForLocation([53.5511, 9.9937]);
        const hamburg = projectGlobeLocation([53.5511, 9.9937], {
            ...projectionConfig,
            phi: hamburgRotation.phi,
            theta: hamburgRotation.theta,
        });
        const losAngeles = projectGlobeLocation([34.0522, -118.2437], {
            ...projectionConfig,
            phi: hamburgRotation.phi,
            theta: hamburgRotation.theta,
        });

        expect(hamburg.visible).toBe(true);
        expect(hamburg.depth).toBeGreaterThan(0.65);
        expect(hamburg.depth).toBeGreaterThan(losAngeles.depth);
        expect(hamburg.x).toBeGreaterThan(210);
        expect(hamburg.x).toBeLessThan(310);
    });
});
