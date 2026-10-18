import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBlurhashPlaceholder } from '../../components/images/blurhashPlaceholder';
import { ProgressiveImage } from '../../components/ProgressiveImage';

describe('server-rendered progressive images', () => {
    const hash = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
    it('creates a cached deterministic placeholder without a browser or canvas', () => {
        const placeholder = createBlurhashPlaceholder(hash);
        expect(placeholder).toMatch(/^data:image\/svg\+xml,/);
        expect(createBlurhashPlaceholder(hash)).toBe(placeholder);
        expect(decodeURIComponent(placeholder!)).toContain('<rect');
        expect(createBlurhashPlaceholder('invalid')).toBeNull();
    });
    it('includes the placeholder and visible real image in the initial server HTML', () => {
        const html = renderToString(React.createElement(ProgressiveImage, { src: '/images/test.webp', alt: 'Trip map', placeholderBlurhash: hash }));
        expect(html).toContain('data:image/svg+xml,');
        expect(html).toContain('alt="Trip map"');
        expect(html).toContain('opacity-100');
        expect(html).not.toContain('opacity-0');
    });
});
