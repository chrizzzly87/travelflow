// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Load order matters: the app's dev entry loads preact/debug before
// preact/hooks, so the hooks runtime wraps debug's option hooks.
import 'preact/debug';
import { h, render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { setupRerender } from 'preact/test-utils';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import { ActivityTypeIcon } from '../../components/ActivityTypeVisuals';
import { buildActivityIconInnerMarkup, buildActivityIconMarkup } from '../../components/maps/activityIconMarkup';
import { ACTIVITY_TYPE_VALUES } from '../../shared/activityTypes';

const readInnerSvg = (markup: string): string => markup.slice(markup.indexOf('>') + 1, markup.lastIndexOf('</svg>'));

/**
 * Mirrors ItineraryMap: a marker effect builds icon markup, and the component
 * re-renders before paint, so preact/hooks flushes that pending effect inside
 * `options._render`, between setting the current component and running the
 * first hook of the body.
 */
const renderMarkerMapThroughTwoUpdates = (buildIcon: (size: number) => string) => {
    const rerender = setupRerender();
    const root = document.createElement('div');
    let setSize: (size: number) => void = () => {};
    const MarkerMap = ({ size }: { size: number }) => {
        const [label] = useState('markers');
        useEffect(() => {
            buildIcon(size);
        }, [size]);
        return h('div', null, `${label}:${size}`);
    };
    const App = () => {
        const [size, update] = useState(11);
        setSize = update;
        return h(MarkerMap, { size });
    };
    render(h(App, null), root);
    setSize(12);
    rerender();
    setSize(13);
    rerender();
    return root.textContent;
};

describe('activity marker icon markup', () => {
    it.each(ACTIVITY_TYPE_VALUES)('draws the same %s glyph as ActivityTypeIcon', (type) => {
        const rendered = renderToStaticMarkup(React.createElement(ActivityTypeIcon, { type, size: 14 }));
        expect(buildActivityIconInnerMarkup(type)).toBe(readInnerSvg(rendered));
        expect(readInnerSvg(buildActivityIconMarkup(type, 14))).toBe(readInnerSvg(rendered));
    });

    it('sizes and styles the marker svg', () => {
        const markup = buildActivityIconMarkup('food', 17);
        expect(markup.startsWith('<svg style="width:17px;height:17px;')).toBe(true);
        expect(markup).toContain('width="17" height="17" viewBox="0 0 24 24"');
        expect(markup.endsWith('</svg>')).toBe(true);
    });

    it('reproduces the dev crash when a marker effect nests a Preact string render', () => {
        expect(() => renderMarkerMapThroughTwoUpdates((size) => renderToString(h('svg', { width: size })))).toThrow(
            'Hook can only be invoked from render methods.',
        );
    });

    it('builds marker icons inside a flushed effect without breaking the live render', () => {
        const types = ['nightlife', 'hiking', 'beach'] as const;
        expect(renderMarkerMapThroughTwoUpdates((size) => buildActivityIconMarkup(types[size % types.length], size + 100))).toBe(
            'markers:13',
        );
    });
});
