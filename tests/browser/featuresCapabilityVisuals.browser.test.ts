// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
    FeaturesCapabilities,
    type FeatureCapabilityItem,
} from '../../components/marketing/features/FeaturesCapabilities';

const items: FeatureCapabilityItem[] = [
    { id: 'draft', eyebrow: 'Draft', title: 'Drafted in seconds', description: 'Say where and how long.' },
    { id: 'shape', eyebrow: 'Shape', title: 'Shaped by hand', description: 'Drag a stop.' },
    { id: 'share', eyebrow: 'Share', title: 'Shared as one link', description: 'No account to create.' },
];

const renderCards = () => render(React.createElement(FeaturesCapabilities, { items }));

describe('components/marketing/features/FeaturesCapabilities', () => {
    /**
     * Regression: all three cards previously showed the same kind of still trip
     * map, so "shaped" and "shared" were illustrated by the same thing as
     * "drafted" and none of them depicted its own verb.
     */
    it('gives every capability its own visual', () => {
        const { container } = renderCards();
        const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

        expect(sources).toHaveLength(3);
        expect(new Set(sources).size).toBe(3);
    });

    it('gives every capability its own entry motion, matching its verb', () => {
        const { container } = renderCards();
        const motions = Array.from(container.querySelectorAll('img')).map((img) => (
            Array.from(img.classList).find((name) => name.startsWith('tf-capability-'))
        ));

        expect(motions).toEqual(['tf-capability-draw', 'tf-capability-handle', 'tf-capability-settle']);
    });

    it('illustrates sharing with a real share card rather than another map', () => {
        const { container } = renderCards();
        const sources = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src') || '');

        expect(sources[0]).toContain('/trip-maps/routes/');
        expect(sources[1]).toContain('/trip-maps/routes/');
        expect(sources[2]).toContain('/marketing/features-share-preview');
        // The two route maps must not be the same map either.
        expect(sources[0]).not.toBe(sources[1]);
    });

    it('renders each card eyebrow and keeps the visuals out of the accessibility tree', () => {
        const { container } = renderCards();

        expect(container.textContent).toContain('Draft');
        expect(container.textContent).toContain('Shape');
        expect(container.textContent).toContain('Share');

        for (const img of Array.from(container.querySelectorAll('img'))) {
            expect(img.getAttribute('alt')).toBe('');
            expect(img.getAttribute('aria-hidden')).toBe('true');
        }
    });
});
